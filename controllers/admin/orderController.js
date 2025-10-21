const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const Product = require("../../models/productSchema");
const formatDate = require("../../helpers/dateFormatter");
const http = require("../../helpers/const");



const getOrders = async (req, res) => {
  try {
    const search = req.query.search || "";
    const sort = req.query.sort || "-createdOn";
    const statusFilter = req.query.status || "";
    const paymentFilter = req.query.payment || "";

    let matchQuery = {};
    if (search) {
      matchQuery.orderId = { $regex: search, $options: "i" };
    }
    if (statusFilter) {
      matchQuery.status = statusFilter;
    }
    if (paymentFilter) {
      matchQuery.paymentStatus = paymentFilter;
    }

    const orders = await Order.aggregate([
      {
        $match: {
          $and: [
            matchQuery, // Existing search/status/payment filters
            {
              $or: [
                { paymentMethod: { $ne: "razorpay" } },  // Include non-Razorpay
                { paymentStatus: { $ne: "Pending" } }    // Include Razorpay only if not Pending
              ]
            }
          ]
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.product",
          foreignField: "_id",
          as: "orderedItemsProduct",
        },
      },
      {
        $addFields: {
          hasPendingReturn: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$orderedItems",
                    as: "item",
                    cond: { $eq: ["$$item.returnStatus", "pending"] },
                  },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $sort: {
          hasPendingReturn: -1,
          [sort.startsWith("-") ? sort.slice(1) : sort]: sort.startsWith("-") ? -1 : 1,
        },
      },
    ]);

    orders.forEach(order => {
      order.formattedDate = formatDate(order.createdOn);
    });

    res.render("adminorders", {
      title: "Order Management",
      orders: orders || [],
      currentPage: 1,
      totalPages: 1,
      limit: 0,
      search,
      sort,
      statusFilter,
      paymentFilter,
    });
  } catch (error) {
    console.error('Error in getOrders:', error);
    res.status(http.Internal_Server_Error).render("admin/admin-error", {
      title: "Error",
      message: "Unable to load orders. Please try again later.",
    });
  }
};


const getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate("user", "name email")
      .populate("orderedItems.product", "productName price productImage");
    if (!order) {
      return res.status(http.Not_Found).render("admin-error", {
        title: "Error",
        message: `Order ${req.params.orderId} not found`,
      });
    }

    // Add this check
    if (order.paymentMethod === "razorpay" && order.paymentStatus === "Pending") {
      return res.status(http.Not_Found).render("admin-error", {
        title: "Error",
        message: `Order ${req.params.orderId} not found`,
      });
    }

    const notification = req.session.notification || null;
    req.session.notification = null;

    order.formattedDate = formatDate(order.createdOn);
    res.render("orderDetails", {
      title: `Order ${order.orderId}`,
      order,
      notification,
    });
  } catch (error) {
    res.status(http.Internal_Server_Error).render("admin-error", {
      title: "Error",
      message: "Unable to load order details. Please try again later.",
    });
  }
};



const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Order.findOne({ orderId }).populate("orderedItems.product");
    if (!order) {
      return res.status(http.Not_Found).render("admin-error", {
        title: "Error",
        message: `Order ${orderId} not found`,
      });
    }

    if (order.paymentStatus === "Failed") {
      return res.status(http.Bad_Request).render("admin-error", {
        title: "Error",
        message: "Cannot update status for orders with failed payments"
      });
    }

    const validTransitions = {
      Pending: ["Processing", "Cancelled"],
      Processing: ["Shipped", "Cancelled"],
      Shipped: ["Out for Delivery"],
      "Out for Delivery": ["Delivered"],
      Delivered: ["Return Request"],
      "Return Request": ["Delivered", "Returned"],
      Cancelled: [],
      Returned: [],
    };

    if (!validTransitions[order.status].includes(status)) {
      return res.status(http.Bad_Request).render("admin-error", {
        title: "Error",
        message: `Invalid status transition from ${order.status} to ${status}`,
      });
    }

    order.status = status;

    const userId = order.user._id ? order.user._id : order.user;

    if (status === "Delivered") {
      order.paymentStatus = order.paymentMethod === "cod" ? "Completed" : order.paymentStatus;
      order.deliveredOn = new Date();
    } else if (status === "Cancelled") {
      let refundAmount = order.finalAmount;

      // Cancel all items and restock
      for (const item of order.orderedItems) {
        if (!item.cancelled && !item.returned) {
          await Product.findByIdAndUpdate(item.product._id, { $inc: { quantity: item.quantity } });
          item.cancelled = true;
          item.cancelReason = "Order cancelled by admin";
        }
      }

      // Refund Wallet / Online payments
      if (refundAmount > 0 && order.paymentMethod !== "cod") {
        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
          wallet = new Wallet({
            user: userId,
            balance: refundAmount,
            transactions: [
              {
                type: "credit",
                amount: refundAmount,
                description: `Refund for order ${order.orderId} (Cancelled by admin)`,
                date: new Date(),
              },
            ],
          });
        } else {
          wallet.balance += refundAmount;
          wallet.transactions.push({
            type: "credit",
            amount: refundAmount,
            description: `Refund for order ${order.orderId} (Cancelled by admin)`,
            date: new Date(),
          });
        }
        await wallet.save();
      }

      // Reset amounts
      order.finalAmount = 0;
      order.tax = 0;
      order.shippingCharge = 0;
      order.discount = 0;

      // Update paymentStatus depending on payment method
      if (["wallet", "razorpay", "wallet+razorpay"].includes(order.paymentMethod)) {
        order.paymentStatus = "Completed";  // Wallet / Online payments
      } else {
        order.paymentStatus = "Cancelled";  // COD
      }
    } else if (status === "Returned") {
      const activeItems = order.orderedItems.filter(i => !i.cancelled && i.returnStatus !== "approved");
      order.totalPrice = activeItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      order.tax = order.totalPrice > 0 ? order.totalPrice * 0.05 : 0;
      order.shippingCharge = order.totalPrice > 0 ? 50 : 0;
      order.finalAmount = order.totalPrice + order.tax + order.shippingCharge - order.discount - order.walletAmount;

      if (order.paymentMethod === "cod" && activeItems.length === 0) {
        order.paymentStatus = "Completed";
      }
    }

    await order.save();
    req.session.notification = { type: "info", text: `Order status updated to ${status}.` };
    res.redirect(`/admin/orders/${orderId}`);
  } catch (error) {
    console.error("Error in updateOrderStatus:", error);
    res.status(http.Internal_Server_Error).render("admin-error", {
      title: "Error",
      message: "Unable to update order status. Please try again later.",
    });
  }
};



const verifyReturnRequest = async (req, res) => {
  try {
    const { orderId, itemIndex, action } = req.body;
    const order = await Order.findOne({ orderId }).populate("orderedItems.product");
    if (!order) {
      return res.status(http.Not_Found).json({ success: false, error: `Order ${orderId} not found` });
    }

    const item = order.orderedItems[itemIndex];
    if (!item || item.returnStatus !== "pending" || item.cancelled) {
      return res.status(http.Bad_Request).json({ success: false, error: "Invalid return request" });
    }

    let notificationMessage = "";
    let refundAmount = 0;

    if (action === "accept") {
      item.returnStatus = "approved";
      await Product.findByIdAndUpdate(item.product._id, { $inc: { quantity: item.quantity } })
        .catch(err => { throw new Error(`Failed to update product quantity: ${err.message}`); });


      const originalTotalItemsPrice = order.orderedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      const itemPrice = item.price * item.quantity;
      const itemProportion = originalTotalItemsPrice > 0 ? itemPrice / originalTotalItemsPrice : 0;


      order.tax = order.tax || 0;
      order.shippingCharge = order.shippingCharge || 0;
      order.discount = order.discount || 0;

     const originalItemTotal = itemPrice + (itemProportion * order.tax)  + (itemProportion * order.shippingCharge);
let proratedDiscount = order.discount * itemProportion;


      const remainingSubTotal = originalTotalItemsPrice - itemPrice;
      const coupon = order.couponId ? await Coupon.findById(order.couponId) : null;
      if (coupon && remainingSubTotal < coupon.minimumPrice) {
        order.discount = 0;
        order.couponApplied = false;
        order.couponId = null;
        proratedDiscount = 0;
      }

      refundAmount = originalItemTotal - proratedDiscount;

      order.totalPrice = remainingSubTotal;
      order.tax = order.tax || (order.totalPrice > 0 ? order.totalPrice * 0.05 : 0);
      order.shippingCharge = remainingSubTotal > 0 ? 50 : 0;
      if (remainingSubTotal > 0 && order.couponApplied) {
        const newTotalBeforeDiscount = remainingSubTotal + order.tax + order.shippingCharge;
        order.discount = coupon ? (newTotalBeforeDiscount * coupon.discountPercentage) / 100 : 0;
        if (order.discount > newTotalBeforeDiscount) order.discount = newTotalBeforeDiscount;
      } else {
        order.discount = 0;
      }
      order.finalAmount = order.totalPrice + order.tax + order.shippingCharge - order.discount - (order.walletAmount || 0);


      if (refundAmount > 0) {
        let wallet = await Wallet.findOne({ user: order.user });
        if (!wallet) {
          wallet = new Wallet({
            user: order.user,
            balance: refundAmount,
            transactions: [
              {
                type: "credit",
                amount: refundAmount,
                description: `Refund for item in order ${order.orderId} (Returned)`,
                date: new Date(),
              },
            ],
          });
        } else {
          wallet.balance += refundAmount;
          wallet.transactions.push({
            type: "credit",
            amount: refundAmount,
            description: `Refund for item in order ${order.orderId} (Returned)`,
            date: new Date(),
          });
        }
        await wallet.save().catch(err => { throw new Error(`Failed to save wallet: ${err.message}`); });
      }

      notificationMessage = `Return request for item in order ${order.orderId.substring(0, 8)} has been approved, and a refund of ₹${refundAmount.toFixed(2)} has been credited to the user's wallet.`;
    } else if (action === "reject") {
      item.returnStatus = "rejected";
      notificationMessage = `Return request for item in order ${order.orderId.substring(0, 8)} has been rejected.`;
    }


    const nonCancelledItems = order.orderedItems.filter(i => !i.cancelled);
    const allNonCancelledApprovedOrCancelled = nonCancelledItems.every(i => i.returnStatus === "approved" || i.cancelled);
    const hasPendingReturns = order.orderedItems.some(i => i.returnStatus === "pending");

    if (allNonCancelledApprovedOrCancelled) {
      order.status = "Returned";
      order.paymentStatus = "Completed";
    } else {
      order.status = hasPendingReturns ? "Return Request" : "Delivered";
      order.paymentStatus = hasPendingReturns ? "Pending" : "Completed";
    }

    await order.save().catch(err => { throw new Error(`Failed to save order: ${err.message}`); });
    res.status(http.OK).json({ success: true, message: notificationMessage });
  } catch (error) {
    console.error("Error in verifyReturnRequest:", error);
    res.status(http.Internal_Server_Error).json({ success: false, error: "Unable to process return request. Please try again later." });
  }
};


const clearFilters = async (req, res) => {
  res.redirect("/admin/orders");
};


module.exports = {
  getOrders,
  getOrderDetails,
  updateOrderStatus,
  verifyReturnRequest,
  clearFilters,
};
