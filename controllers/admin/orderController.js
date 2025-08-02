const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const Product = require("../../models/productSchema");



const getOrders = async (req, res) => {
  try {
    console.log('Session:', req.session);
    console.log('Query Parameters:', req.query);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const sort = req.query.sort || "-createdOn";
    const statusFilter = req.query.status || "";
    const paymentFilter = req.query.payment || "";

    let query = {};
    if (search) {
      query.orderId = { $regex: search, $options: "i" };
    }
    if (statusFilter) {
      query.status = statusFilter;
    }
    if (paymentFilter) {
      query.paymentStatus = paymentFilter;
    }

    const totalOrders = await Order.countDocuments(query);
    console.log('Query:', query);
    console.log('Total Orders:', totalOrders);

    const orders = await Order.find(query)
      .populate("user", "name email")
      .populate("orderedItems.product", "productName")
      .sort(sort)
      .skip(skip)
      .limit(limit);

    console.log('Orders:', orders);

    res.render("adminorders", {
      title: "Order Management",
      orders: orders || [],
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit) || 1,
      limit,
      search,
      sort,
      statusFilter,
      paymentFilter,
    });
  } catch (error) {
    console.error('Error in getOrders:', error);
    res.status(500).render("admin/admin-error", {
      title: "Error",
      message: "Unable to load orders. Please try again later.",
    });
  }
};


const getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate("user", "name email")
      .populate("orderedItems.product", "productName price");
    if (!order) {
      return res.status(404).render("admin-error", {
        title: "Error",
        message: `Order ${req.params.orderId} not found`,
      });
    }
    // Pass the notification from the session to the template
    const notification = req.session.notification || null;
    // Clear the notification from the session after rendering
    req.session.notification = null;
    res.render("orderDetails", {
      title: `Order ${order.orderId}`,
      order,
      notification,
    });
  } catch (error) {
    console.error('Error in getOrderDetails:', error);
    res.status(500).render("admin-error", {
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
      return res.status(404).render("admin-error", {
        title: "Error",
        message: `Order ${orderId} not found`,
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
      return res.status(400).render("admin-error", {
        title: "Error",
        message: `Invalid status transition from ${order.status} to ${status}`,
      });
    }

    order.status = status;
    if (status === "Delivered") {
      order.paymentStatus = "Completed";
      order.deliveredOn = new Date();
    } else if (status === "Cancelled") {
      order.paymentStatus = "Failed";
      let refundAmount = order.finalAmount;
      for (const item of order.orderedItems) {
        if (!item.cancelled && !item.returned) {
          await Product.findByIdAndUpdate(item.product._id, { $inc: { quantity: item.quantity } });
          item.cancelled = true;
          item.cancelReason = "Order cancelled by admin";
        }
      }
      if (refundAmount > 0 && order.paymentMethod !== "cod") {
        let wallet = await Wallet.findOne({ user: order.user });
        if (!wallet) {
          wallet = new Wallet({
            user: order.user,
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
      order.finalAmount = 0;
      order.tax = 0;
      order.shippingCharge = 0;
    } else if (status === "Returned") {
      order.paymentStatus = "Completed";
      const activeItems = order.orderedItems.filter(i => !i.cancelled && i.returnStatus !== "approved");
      order.totalPrice = activeItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      order.tax = order.totalPrice > 0 ? order.totalPrice * 0.05 : 0;
      order.shippingCharge = order.totalPrice > 0 ? 50 : 0;
      order.finalAmount = order.totalPrice + order.tax + order.shippingCharge - order.discount - order.walletAmount;
    }

    await order.save();
    req.session.notification = { type: "info", text: `Order status updated to ${status}.` };
    res.redirect(`/admin/orders/${orderId}`);
  } catch (error) {
    console.error("Error in updateOrderStatus:", error);
    res.status(500).render("admin-error", {
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
      return res.status(404).json({ success: false, error: `Order ${orderId} not found` });
    }

    const item = order.orderedItems[itemIndex];
    if (!item || item.returnStatus !== "pending" || item.cancelled) {
      return res.status(400).json({ success: false, error: "Invalid return request" });
    }

    let notificationMessage = "";
    let refundAmount = item.price * item.quantity;

    if (action === "accept") {
      item.returnStatus = "approved";
      await Product.findByIdAndUpdate(item.product._id, { $inc: { quantity: item.quantity } });

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
      await wallet.save();

      notificationMessage = `Return request for item in order ${order.orderId} has been approved, and a refund of ₹${refundAmount.toFixed(2)} has been credited to the user's wallet.`;
    } else if (action === "reject") {
      item.returnStatus = "rejected";
      notificationMessage = `Return request for item in order ${order.orderId} has been rejected.`;
    }

    // Recalculate order financials
    const activeItems = order.orderedItems.filter(i => !i.cancelled && i.returnStatus !== "approved");
    order.totalPrice = activeItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    order.tax = order.totalPrice > 0 ? order.totalPrice * 0.05 : 0;
    order.shippingCharge = order.totalPrice > 0 ? 50 : 0;
    order.finalAmount = order.totalPrice + order.tax + order.shippingCharge - order.discount - order.walletAmount;

    // Update order status
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

    await order.save();
    res.status(200).json({ success: true, message: notificationMessage });
  } catch (error) {
    console.error("Error in verifyReturnRequest:", error);
    res.status(500).json({ success: false, error: "Unable to process return request. Please try again later." });
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