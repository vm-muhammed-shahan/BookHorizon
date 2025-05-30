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
      .populate("orderedItems.product", "name")
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
      .populate("orderedItems.product", "name price");
    if (!order) {
      return res.status(404).render("admin-error", {
        title: "Error",
        message: `Order ${req.params.orderId} not found`,
      });
    }
    res.render("orderDetails", {
      title: `Order ${order.orderId}`,
      order,
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
    await order.save();

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
    const order = await Order.findOne({ orderId });
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
    if (action === "accept") {
      item.returnStatus = 'approved';
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
      const wallet = await Wallet.findOne({ user: order.user });
      if (!wallet) {
        const newWallet = new Wallet({
          user: order.user,
          balance: item.price * item.quantity,
          transactions: [{
            type: "credit",
            amount: item.price * item.quantity,
            description: `Refund for order ${order.orderId}`,
          }],
        });
        await newWallet.save();
      } else {
        wallet.balance += item.price * item.quantity;
        wallet.transactions.push({
          type: "credit",
          amount: item.price * item.quantity,
          description: `Refund for order ${order.orderId}`,
        });
        await wallet.save();
      }
      notificationMessage = `Your return request for order ${order.orderId} has been approved, and a refund has been credited to your wallet.`;
    } else if (action === "reject") {
      item.returned = false;
      item.returnReason = "";
      item.returnStatus = 'rejected';
      notificationMessage = `Your return request for order ${order.orderId} has been rejected.`;
    }

    // Update order status based on all items
    const allApproved = order.orderedItems.every(i => i.returnStatus === 'approved' || i.cancelled || !i.returned);
    const hasPendingReturns = order.orderedItems.some(i => i.returnStatus === 'pending');
    if (allApproved) {
      order.status = 'Returned';
      order.paymentStatus = 'Completed';
    } else if (!hasPendingReturns) {
      order.status = 'Delivered';
      order.paymentStatus = 'Completed';
    } else {
      order.status = 'Return Request';
      order.paymentStatus = 'Pending';
    }

    await order.save();

    // Store notification in user session
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