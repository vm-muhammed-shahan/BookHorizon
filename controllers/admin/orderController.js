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

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).render("admin-error", {
        title: "Error",
        message: `Order ${orderId} not found`,
      });
    }

    order.status = status;
    // Update payment status if necessary
    if (status === 'Delivered') {
      order.paymentStatus = 'Completed';
    } else if (status === 'Cancelled') {
      order.paymentStatus = 'Failed';
    }
    // No change to paymentStatus for "Out for Delivery" (remains as is, typically "Pending" until Delivered)
    await order.save();

    req.session.notification = { type: 'info', text: `Order status updated to ${status}.` };
    res.redirect(`/admin/orders/${orderId}`);
  } catch (error) {
    console.error('Error in updateOrderStatus:', error);
    res.status(500).render("admin-error", {
      title: "Error",
      message: "Unable to update order status. Please try again later.",
    });
  }
};


const verifyReturnRequest = async (req, res) => {
  try {
    const { orderId, itemIndex, action } = req.body;
    const order = await Order.findOne({ orderId }).populate('orderedItems.product');
    if (!order) {
      return res.status(404).render("admin-error", {
        title: "Error",
        message: `Order ${orderId} not found`,
      });
    }

    const item = order.orderedItems[itemIndex];
    if (!item || item.returnStatus !== 'pending' || item.cancelled) {
      return res.status(400).render("admin-error", {
        title: "Error",
        message: "Invalid return request",
      });
    }

    let notificationMessage = '';
    let refundAmount = item.price * item.quantity;

    if (action === "accept") {
      item.returnStatus = 'approved';
      // Increment product stock atomically
      await Product.findByIdAndUpdate(item.product._id, { $inc: { quantity: item.quantity } });
      
      // Refund to wallet
      let wallet = await Wallet.findOne({ user: order.user });
      if (!wallet) {
        wallet = new Wallet({
          user: order.user,
          balance: refundAmount,
          transactions: [{
            type: "credit",
            amount: refundAmount,
            description: `Refund for item in order ${order.orderId} (Returned)`,
            date: new Date()
          }],
        });
      } else {
        wallet.balance += refundAmount;
        wallet.transactions.push({
          type: "credit",
          amount: refundAmount,
          description: `Refund for item in order ${order.orderId} (Returned)`,
          date: new Date()
        });
      }
      await wallet.save();
      
      console.log(`Refunded ₹${refundAmount.toFixed(2)} to wallet for user ${order.user} for order ${order.orderId}`);
      notificationMessage = `Your return request for an item in order ${order.orderId} has been approved, and a refund of ₹${refundAmount.toFixed(2)} has been credited to your wallet.`;
    } else if (action === "reject") {
      item.returnStatus = 'rejected';
      notificationMessage = `Your return request for an item in order ${order.orderId} has been rejected.`;
    }

    // Update order status based on the items' return statuses
    const allApproved = order.orderedItems.every(i => i.returnStatus === 'approved' || i.cancelled || !i.returned);
    const hasPendingReturns = order.orderedItems.some(i => i.returnStatus === 'pending');
    if (allApproved && order.orderedItems.every(i => i.returnStatus === 'approved' || i.cancelled)) {
      order.status = 'Returned';
      order.paymentStatus = 'Completed';
    } else if (!hasPendingReturns) {
      // If there are no pending returns, revert to the original status (e.g., Delivered)
      order.status = 'Delivered'; // Assuming the order was delivered before the return request
      order.paymentStatus = 'Completed';
    } else {
      order.status = 'Return Request';
      order.paymentStatus = 'Pending';
    }

    await order.save();

    req.session.notification = { type: 'info', text: notificationMessage };

    res.redirect(`/admin/orders/${orderId}`);
  } catch (error) {
    console.error('Error in verifyReturnRequest:', error);
    res.status(500).render("admin-error", {
      title: "Error",
      message: "Unable to process return request. Please try again later.",
    });
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