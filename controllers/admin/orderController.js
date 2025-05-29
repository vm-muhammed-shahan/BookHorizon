const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateHr = (doc, y) => {
  doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
};

const generateTableRow = (doc, y, item, unitPrice, quantity, lineTotal) => {
  doc
    .fontSize(10)
    .text(item, 50, y)
    .text(unitPrice, 280, y, { width: 90, align: 'right' })
    .text(quantity, 370, y, { width: 90, align: 'right' })
    .text(lineTotal, 0, y, { align: 'right' });
};

const generateFooter = (doc) => {
  doc.fontSize(10).text('Thank you for shopping with us.', 50, 700, {
    align: 'center',
    width: 500
  });
};

const generateTableHeader = (doc, y) => {
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('Item', 50, y)
    .text('Unit Price', 280, y, { width: 90, align: 'right' })
    .text('Qty', 370, y, { width: 90, align: 'right' })
    .text('Line Total', 0, y, { align: 'right' });

  generateHr(doc, y + 20);
};

const generateTotalRow = (doc, y, label, value) => {
  doc.fontSize(10).text(label, 50, y).text(value, 0, y, { align: 'right' });
};

const generateItemsTable = (doc, order, y) => {
  let i;
  const tableTop = y + 30;

  for (i = 0; i < order.orderedItems.length; i++) {
    const item = order.orderedItems[i];
    const position = tableTop + i * 30;

    generateTableRow(
      doc,
      position,
      item.product.productName,
      `₹${item.price.toFixed(2)}`,
      item.quantity,
      `₹${(item.price * item.quantity).toFixed(2)}`
    );

    generateHr(doc, position + 20);
  }

  let returnedItemsTotal = 0;
  order.orderedItems.forEach((item) => {
    if (item.returnStatus === 'Returned') {
      returnedItemsTotal += item.price * item.quantity;
    }
  });

  const subtotal =
    (order.totalPrice || 0) +
    (order.discount || 0) +
    (order.couponDiscount || 0);

  const subtotalPosition = tableTop + i * 30;
  generateTotalRow(
    doc,
    subtotalPosition,
    'Subtotal',
    `₹${subtotal.toFixed(2)}`
  );

  if (order.discount > 0) {
    const discountPosition = subtotalPosition + 20;
    generateTotalRow(
      doc,
      discountPosition,
      'Product Discount',
      `-₹${order.discount.toFixed(2)}`
    );
  }

  const couponDiscountPosition =
    order.discount > 0 ? subtotalPosition + 40 : subtotalPosition + 20;
  generateTotalRow(
    doc,
    couponDiscountPosition,
    'Coupon Discount',
    `-₹${(order.couponDiscount || 0).toFixed(2)}`
  );

  const shippingPosition = couponDiscountPosition + 20;
  generateTotalRow(
    doc,
    shippingPosition,
    'Shipping',
    `₹${order.shippingCost.toFixed(2)}`
  );

  let returnedItemsPosition;
  if (returnedItemsTotal > 0) {
    returnedItemsPosition = shippingPosition + 20;
    generateTotalRow(
      doc,
      returnedItemsPosition,
      'Returned Items',
      `-₹${returnedItemsTotal.toFixed(2)}`
    );
  }

  const totalPosition =
    returnedItemsTotal > 0 ? returnedItemsPosition + 20 : shippingPosition + 20;
  doc.font('Helvetica-Bold');
  generateTotalRow(
    doc,
    totalPosition,
    'Total',
    `₹${(order.totalPrice - (returnedItemsTotal + order.couponDiscount || 0)).toFixed(2)}`
  );
  doc.font('Helvetica');
};

const generateInvoice = async (req, order, res, isAdmin = false) => {
  try {
    const doc = new PDFDocument({ margin: 50 });
    const fileName = `invoice_${order.orderId}.pdf`;

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/pdf');

    doc.pipe(res);

    doc
      .fillColor('#444444')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('HearZone', 0, 30, { align: 'center' })
      .fontSize(10)
      .font('Helvetica')
      .text('Sounds Never Settle', 0, 55, { align: 'center' })
      .moveDown();

    doc
      .fillColor('#444444')
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('INVOICE', 50, 80, { align: 'left' })
      .fontSize(10)
      .font('Helvetica')
      .text(`Invoice #: ${order.orderId}`, 50, 110, { align: 'left' })
      .text(
        `Invoice Date: ${order.invoiceDate?.toLocaleDateString() || new Date().toLocaleDateString()}`,
        50,
        125,
        { align: 'left' }
      )
      .moveDown();

    const customer = isAdmin ? order.userId : req.session.user;
    const shippingAddress = order.address;

    doc
      .fillColor('#444444')
      .fontSize(14)
      .text('Bill To:', 50, 160)
      .fontSize(10)
      .text(customer.name, 50, 180)
      .text(shippingAddress.landmark, 50, 195)
      .text(
        `${shippingAddress.city}, ${shippingAddress.state} - ${shippingAddress.pinCode}`,
        50,
        210
      )
      .text(`Phone: ${shippingAddress.phone}`, 50, 225)
      .moveDown();

    const invoiceTableTop = 250;
    generateTableHeader(doc, invoiceTableTop);
    generateItemsTable(doc, order, invoiceTableTop);
    generateFooter(doc);

    doc.end();
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Failed to generate invoice');
  }
};










const listOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    let search = req.query.search || '';
    const statusFilter = req.query.status || '';
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    let query = { isVisibleToAdmin: true };

    if (search) {
      let searchQuery = search.trim();
      if (searchQuery.startsWith('Order #')) {
        searchQuery = searchQuery.replace('Order #', '').trim();
      } else if (searchQuery.startsWith('Order Details - #')) {
        searchQuery = searchQuery.replace('Order Details - #', '').trim();
      }

      const orderIdPattern = new RegExp(
        searchQuery.replace(/[-\s]/g, '.*'),
        'i'
      );

      query.$or = [
        { orderId: orderIdPattern },
        { 'address.name': { $regex: searchQuery, $options: 'i' } },
        { 'address.city': { $regex: searchQuery, $options: 'i' } },
        { 'userId.name': { $regex: searchQuery, $options: 'i' } },
        { 'userId.email': { $regex: searchQuery, $options: 'i' } }
      ];
    }

    if (statusFilter) {
      query.status = statusFilter;
    }

    if (dateFrom && dateTo) {
      query.createdAt = {
        $gte: new Date(dateFrom.setHours(0, 0, 0, 0)),
        $lte: new Date(dateTo.setHours(23, 59, 59, 999))
      };
    } else if (dateFrom) {
      query.createdAt = {
        $gte: new Date(dateFrom.setHours(0, 0, 0, 0))
      };
    } else if (dateTo) {
      query.createdAt = {
        $lte: new Date(dateTo.setHours(23, 59, 59, 999))
      };
    }

    let sortObject = {};
    if (sortBy === 'amount') {
      sortObject = { finalAmount: sortOrder };
    } else if (sortBy === 'date') {
      sortObject = { createdAt: sortOrder };
    } else {
      sortObject = { createdAt: -1 };
    }

    const [orders, count] = await Promise.all([
      Order.find(query)
        .populate('userId', 'name email phone')
        .sort(sortObject)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(query)
    ]);

    orders.forEach((order) => {
      order.hasPendingItemRequests = order.orderedItems.some(
        (item) =>
          item.cancellationStatus === 'Cancel Request' ||
          item.returnStatus === 'Return Request'
      );
    });

    const statuses = [
      'Pending',
      'Shipped',
      'Delivered',
      'Cancel Request',
      'Cancelled',
      'Return Request',
      'Returned'
    ];

    const totalPages = Math.ceil(count / limit);

    res.render('admin-orders', {
      orders: orders || [],
      currentPage: page,
      totalPages,
      search,
      statusFilter,
      dateFrom: dateFrom ? dateFrom.toISOString().split('T')[0] : '',
      dateTo: dateTo ? dateTo.toISOString().split('T')[0] : '',
      statuses,
      sortBy,
      sortOrder
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.redirect('/admin/pageError');
  }
};








const viewOrderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate('userId', 'name email phone')
      .populate('orderedItems.product');

    if (!order) {
      return res.redirect('/admin/orders?error=Order not found');
    }

    res.render('order-details', { order });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.redirect('pageError');
  }
};





const trackStatusChange = async (order, newStatus, description, adminId) => {
  if (!order.statusHistory) {
    order.statusHistory = [];
  }

  order.statusHistory.push({
    status: newStatus,
    date: new Date(),
    description: description || `Status changed to ${newStatus}`,
    changedBy: adminId,
    changedByModel: 'Admin'
  });

  await order.save();
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Order.findOne({ orderId }).populate(
      'orderedItems.product'
    );
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const validTransitions = {
      Pending: ['Shipped', 'Cancelled'],
      Shipped: ['Delivered', 'Cancelled'],
      Delivered: [],
      Cancelled: [],
      Returned: []
    };

    const currentStatus = order.status;
    const allowedNextStatuses = validTransitions[currentStatus] || [];

    if (!allowedNextStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${currentStatus} to ${status}. Valid next statuses are: ${allowedNextStatuses.join(', ')}`
      });
    }

    if (status === 'Cancelled') {
      for (const item of order.orderedItems) {
        if (
          item.cancellationStatus === 'None' &&
          item.returnStatus === 'None'
        ) {
          await Product.findByIdAndUpdate(item.product._id, {
            $inc: { quantity: item.quantity }
          });
        }
      }
    }

    order.orderedItems.forEach((item) => {
      if (item.cancellationStatus === 'None' && item.returnStatus === 'None') {
        item.itemStatus = status;
      }
    });

    order.status = status;

    order.statusHistory.push({
      status: status,
      description: `Order status updated to ${status}`,
      changedBy: req.admin._id,
      changedByModel: 'Admin'
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status'
    });
  }
};

const processReturnRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { action } = req.body;

    const order = await Order.findOne({ orderId })
      .populate('userId')
      .populate('orderedItems.product');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.status !== 'Return Request') {
      return res.status(400).json({
        success: false,
        message: 'Order is not in return request status'
      });
    }

    if (action === 'approve') {
      const user = await User.findById(order.userId._id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.wallet) {
        user.wallet = { balance: 0, transactions: [] };
      }

      let refundMessage = '';
      if (order.paymentStatus === 'Paid') {
        const refundAmount = order.finalAmount;
        user.wallet.balance += refundAmount;
        user.wallet.transactions.push({
          amount: refundAmount,
          type: 'credit',
          description: `Refund for returned order ${order.orderId}`,
          date: new Date()
        });

        await Wallet.create({
          userId: user._id,
          amount: refundAmount,
          type: 'credit',
          description: `Refund for returned item in order ${order.orderId}`,
          orderId: order.orderId
        });

        refundMessage = `Return approved. Amount ₹${refundAmount} refunded to wallet.`;
        await user.save();
      } else {
        refundMessage =
          'Return approved. No refund processed as no payment was made.';
      }

      await restoreProductStock(order.orderedItems);

      order.status = 'Returned';
      order.returnReason = null;
      order.paymentStatus =
        order.paymentStatus === 'Paid' ? 'Refunded' : order.paymentStatus;

      await trackStatusChange(order, 'Returned', refundMessage, req.admin._id);

      await order.save();

      return res.json({
        success: true,
        message: refundMessage
      });
    } else if (action === 'reject') {
      order.status = 'Delivered';
      order.returnRejected = true;
      order.returnReason = null;

      await trackStatusChange(
        order,
        'Delivered',
        'Return request rejected by admin',
        req.admin._id
      );
      await order.save();

      return res.json({
        success: true,
        message: 'Return request rejected'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action'
      });
    }
  } catch (error) {
    console.error('Error processing return request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process return request'
    });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const isAdmin = req.path.includes('/admin/');

    const query = { orderId };
    if (!isAdmin) {
      query.userId = req.session.user.id;
    }

    const order = await Order.findOne(query)
      .populate('userId')
      .populate('orderedItems.product');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    await generateInvoice(req, order, res, isAdmin);
  } catch (error) {
    console.error('Error in downloadInvoice:', error);
    res.status(500).send('Failed to generate invoice');
  }
};

const processCancelRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { action } = req.body;

    const order = await Order.findOne({ orderId })
      .populate('userId')
      .populate('orderedItems.product');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.status !== 'Cancel Request') {
      return res.status(400).json({
        success: false,
        message: 'Order is not in cancel request status'
      });
    }

    if (action === 'approve') {
      const user = await User.findById(order.userId._id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      let refundMessage = '';
      if (order.paymentStatus === 'Paid') {
        if (!user.wallet) {
          user.wallet = { balance: 0, transactions: [] };
        }

        const refundAmount = order.finalAmount;
        user.wallet.balance += refundAmount;
        user.wallet.transactions.push({
          amount: refundAmount,
          type: 'credit',
          description: `Refund for cancelled order ${order.orderId}`,
          date: new Date()
        });

        await Wallet.create({
          userId: user._id,
          amount: refundAmount,
          type: 'credit',
          description: `Refund for cancelled order ${order.orderId}`,
          orderId: order.orderId
        });

        refundMessage = `Cancellation approved. Amount ₹${refundAmount} refunded to wallet.`;
        await user.save();
      } else {
        refundMessage =
          'Cancellation approved. No refund processed as no payment was made.';
      }

      await restoreProductStock(order.orderedItems);

      order.status = 'Cancelled';
      order.cancellationReason = null;
      order.paymentStatus =
        order.paymentStatus === 'Paid' ? 'Refunded' : order.paymentStatus;

      await trackStatusChange(order, 'Cancelled', refundMessage, req.admin._id);

      await order.save();

      return res.json({
        success: true,
        message: refundMessage,
        newStatus: 'Cancelled'
      });
    } else if (action === 'reject') {
      const previousStatus =
        order.statusHistory.length > 1
          ? order.statusHistory[order.statusHistory.length - 2].status
          : 'Pending';

      order.status = previousStatus;
      order.cancellationRejected = true;
      order.cancellationReason = null;

      await trackStatusChange(
        order,
        previousStatus,
        'Cancellation request rejected by admin',
        req.admin._id
      );

      await order.save();

      return res.json({
        success: true,
        message: 'Cancellation request rejected',
        newStatus: previousStatus
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action'
      });
    }
  } catch (error) {
    console.error('Error processing cancel request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process cancel request'
    });
  }
};

const restoreProductStock = async (orderedItems) => {
  const bulkOps = orderedItems
    .filter((item) => item.cancellationStatus !== 'Cancelled')
    .map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { quantity: item.quantity } }
      }
    }));

  if (bulkOps.length > 0) {
    await Product.bulkWrite(bulkOps);
  }
};

const getOrderStatusTimeline = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res
        .status(400)
        .json({ success: false, message: 'Order ID is required' });
    }

    const order = await Order.findOne({
      orderId: { $regex: `^${orderId}$`, $options: 'i' }
    })
      .select('statusHistory')
      .lean();

    if (!order) {
      return res
        .status(404)
        .json({
          success: false,
          message: `Order with ID ${orderId} not found`
        });
    }

    const statusTimeline = (order.statusHistory || []).map((entry) => ({
      status: entry.status,
      date: entry.date,
      description: entry.description || `Status changed to ${entry.status}`,
      changedBy: entry.changedBy ? entry.changedBy.toString() : null,
      changedByModel: entry.changedByModel || null
    }));

    res.json({
      success: true,
      timeline: statusTimeline
    });
  } catch (error) {
    console.error(
      `Error fetching order timeline for orderId ${req.params.orderId}:`,
      error
    );
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order timeline',
      error: error.message
    });
  }
};

const processCancelItemRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { itemIndex, action } = req.body;

    if (!orderId) {
      return res
        .status(400)
        .json({ success: false, message: 'Order ID is required' });
    }
    if (itemIndex === undefined || isNaN(itemIndex) || itemIndex < 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid item index' });
    }
    if (!['approve', 'reject'].includes(action)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid action' });
    }

    const order = await Order.findOne({
      orderId: { $regex: `^${orderId}$`, $options: 'i' }
    })
      .populate('userId', 'name email')
      .populate('orderedItems.product');

    if (!order) {
      return res
        .status(404)
        .json({
          success: false,
          message: `Order with ID ${orderId} not found`
        });
    }

    const item = order.orderedItems[itemIndex];
    if (!item) {
      return res
        .status(400)
        .json({
          success: false,
          message: `Item at index ${itemIndex} not found`
        });
    }

    if (item.cancellationStatus !== 'Cancel Request') {
      return res.status(400).json({
        success: false,
        message: `Item is not in cancel request status (current status: ${item.cancellationStatus})`
      });
    }

    if (action === 'approve') {
      const user = await User.findById(order.userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: 'User not found' });
      }

      let refundMessage = '';
      let refundAmount = 0;

      if (order.paymentStatus === 'Paid') {
        if (!user.wallet) {
          user.wallet = { balance: 0, transactions: [] };
        }

        refundAmount = item.price * item.quantity;

        refundAmount = Math.min(refundAmount, order.totalPrice);

        user.wallet.balance += refundAmount;
        user.wallet.transactions.push({
          amount: refundAmount,
          type: 'credit',
          description: `Refund for cancelled item in order ${order.orderId}`,
          date: new Date()
        });

        function generateTransactionId(userId) {
          return `WALLET-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        }

        await Wallet.create({
          userId: user._id,
          amount: refundAmount,
          type: 'credit',
          description: `Refund for cancelled item in order ${order.orderId}`,
          orderId: order.orderId,
          transactionId: generateTransactionId(user._id)
        });

        refundMessage = `Cancellation approved for item: ${item.product.productName}. Amount ₹${refundAmount.toFixed(2)} refunded to wallet.`;
        await user.save();
      } else {
        refundMessage = `Cancellation approved for item: ${item.product.productName}. No refund processed as payment was not made.`;
      }

      await Product.updateOne(
        { _id: item.product._id },
        { $inc: { quantity: item.quantity } }
      );

      item.cancellationStatus = 'Cancelled';
      item.cancellationReason = null;
      item.cancellationRejected = false;

      const nonCancelledItems = order.orderedItems.filter(
        (i) => i.cancellationStatus !== 'Cancelled'
      );
      if (nonCancelledItems.length === 0) {
        order.totalPrice = 0;
        order.discount = 0;
        order.taxes = 0;
        order.shippingCost = 0;
        order.finalAmount = 0;
        order.status = 'Cancelled';
      } else {
        order.totalPrice = nonCancelledItems.reduce(
          (total, i) => total + i.subTotal,
          0
        );

        const originalTotalPrice = order.orderedItems.reduce(
          (total, i) => total + i.subTotal,
          0
        );
        if (originalTotalPrice > 0) {
          order.discount =
            (order.totalPrice / originalTotalPrice) * order.discount;
        } else {
          order.discount = 0;
        }

        order.taxes =
          (order.totalPrice / originalTotalPrice) * order.taxes || 0;

        order.finalAmount = Math.max(
          0,
          order.totalPrice - order.discount + order.taxes + order.shippingCost
        );
      }

      if (nonCancelledItems.length === 0 && order.paymentStatus === 'Paid') {
        order.paymentStatus = 'Refunded';
      }

      await trackStatusChange(
        order,
        order.status,
        refundMessage,
        req.admin._id
      );

      await order.save();

      return res.json({
        success: true,
        message: refundMessage,
        newStatus: order.status
      });
    } else if (action === 'reject') {
      item.cancellationStatus = 'None';
      item.cancellationReason = null;
      item.cancellationRejected = true;

      await trackStatusChange(
        order,
        order.status,
        `Cancellation request rejected for item: ${item.product.productName}`,
        req.admin._id
      );

      await order.save();

      return res.json({
        success: true,
        message: 'Item cancellation request rejected',
        newStatus: order.status
      });
    }
  } catch (error) {
    console.error(
      `Error processing item cancel request for orderId ${req.params.orderId}, itemIndex ${req.body.itemIndex}:`,
      error
    );
    res.status(500).json({
      success: false,
      message: 'Failed to process item cancel request',
      error: error.message
    });
  }
};

const generateTransactionId = (userId) => {
  return `WALLET-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
};

const processReturnItemRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { itemIndex, action } = req.body;

    const order = await Order.findOne({ orderId })
      .populate('userId')
      .populate('orderedItems.product');

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: 'Order not found' });
    }

    const item = order.orderedItems[itemIndex];
    if (!item) {
      return res
        .status(400)
        .json({ success: false, message: 'Item not found' });
    }

    if (action === 'approve') {
      item.returnStatus = 'Returned';

      const refundAmount = item.price * item.quantity;

      if (order.paymentStatus === 'Paid') {
        const user = await User.findById(order.userId._id);
        if (!user) {
          return res
            .status(404)
            .json({ success: false, message: 'User not found' });
        }

        if (!user.wallet) {
          user.wallet = { balance: 0, transactions: [] };
        }

        const transaction = {
          type: 'credit',
          amount: refundAmount,
          description: `Refund for returned item: ${item.product.productName}`,
          orderId: order.orderId,
          transactionId: generateTransactionId(user._id)
        };
        user.wallet.transactions.push(transaction);
        user.wallet.balance += refundAmount;
        await user.save();

        await Wallet.create({
          userId: user._id,
          amount: refundAmount,
          type: 'credit',
          description: `Refund for returned item: ${item.product.productName}`,
          orderId: order.orderId,
          transactionId: transaction.transactionId
        });
      }

      const remainingItems = order.orderedItems.filter(
        (i) => i.returnStatus !== 'Returned'
      );
      if (remainingItems.length === 0) {
        order.totalPrice = 0;
        order.discount = 0;
        order.couponDiscount = 0;
        order.taxes = 0;
        order.shippingCost = 0;
        order.finalAmount = 0;
        order.status = 'Returned';
        if (order.paymentStatus === 'Paid') {
          order.paymentStatus = 'Refunded';
        }
      } else {
        const remainingTotal = remainingItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
        const originalTotal = order.orderedItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );

        const discountRatio = remainingTotal / originalTotal;
        order.discount = order.discount * discountRatio;
        order.couponDiscount = order.couponDiscount * discountRatio;

        order.taxes = remainingTotal * 0.18;

        order.totalPrice = remainingTotal;
        order.finalAmount =
          remainingTotal +
          order.taxes +
          order.shippingCost -
          order.discount -
          order.couponDiscount;
      }

      if (order.status !== 'Returned') {
        const hasReturnRequests = order.orderedItems.some(
          (i) => i.returnStatus === 'Return Request'
        );
        if (hasReturnRequests) {
          order.status = 'Return Request';
        }
      }

      await trackStatusChange(
        order,
        'Returned',
        `Item returned: ${item.product.productName}`,
        req.admin._id
      );

      await order.save();

      res.status(200).json({
        success: true,
        message: 'Return request approved successfully',
        order: {
          status: order.status,
          paymentStatus: order.paymentStatus,
          totalPrice: order.totalPrice,
          finalAmount: order.finalAmount
        }
      });
    } else if (action === 'reject') {
      item.returnStatus = 'None';
      item.returnReason = null;
      item.returnRejected = true;

      const hasReturnRequests = order.orderedItems.some(
        (i) => i.returnStatus === 'Return Request'
      );
      if (!hasReturnRequests) {
        order.status = 'Delivered';
      }

      await trackStatusChange(
        order,
        'Delivered',
        `Return request rejected for item: ${item.product.productName}`,
        req.admin._id
      );

      await order.save();

      res.status(200).json({
        success: true,
        message: 'Return request rejected successfully',
        order: {
          status: order.status
        }
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error in processReturnItemRequest:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to process return request' });
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('userId', 'name email phone')
      .populate('orderedItems.product', 'name images price');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order details',
      error: error.message
    });
  }
};

const getRequestCounts = async (req, res) => {
  try {
    const cancelRequests = await Order.countDocuments({
      'orderedItems.cancellationStatus': 'Cancel Request'
    });
    const returnRequests = await Order.countDocuments({
      'orderedItems.returnStatus': 'Return Request'
    });

    res.json({
      cancelRequests,
      returnRequests
    });
  } catch (error) {
    console.error('Error getting request counts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getCancelRequests = async (req, res) => {
  try {
    const requests = await Order.find({
      'orderedItems.cancellationStatus': 'Cancel Request'
    })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Error getting cancel requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getReturnRequests = async (req, res) => {
  try {
    const requests = await Order.find({
      'orderedItems.returnStatus': 'Return Request'
    })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Error getting return requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const handleCancelRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { action } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const itemsWithCancelRequest = order.orderedItems.filter(
      (item) => item.cancellationStatus === 'Cancel Request'
    );

    if (itemsWithCancelRequest.length === 0) {
      return res
        .status(400)
        .json({ error: 'No cancel requests found for this order' });
    }

    if (action === 'approve') {
      order.orderedItems.forEach((item) => {
        if (item.cancellationStatus === 'Cancel Request') {
          item.cancellationStatus = 'Cancelled';
        }
      });
    } else if (action === 'reject') {
      order.orderedItems.forEach((item) => {
        if (item.cancellationStatus === 'Cancel Request') {
          item.cancellationStatus = 'None';
        }
      });
    }

    await order.save();
    res.json({ message: 'Request handled successfully' });
  } catch (error) {
    console.error('Error handling cancel request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const handleReturnRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { action } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const itemsWithReturnRequest = order.orderedItems.filter(
      (item) => item.returnStatus === 'Return Request'
    );

    if (itemsWithReturnRequest.length === 0) {
      return res
        .status(400)
        .json({ error: 'No return requests found for this order' });
    }

    if (action === 'approve') {
      order.orderedItems.forEach((item) => {
        if (item.returnStatus === 'Return Request') {
          item.returnStatus = 'Returned';
        }
      });
    } else if (action === 'reject') {
      order.orderedItems.forEach((item) => {
        if (item.returnStatus === 'Return Request') {
          item.returnStatus = 'None';
        }
      });
    }

    await order.save();
    res.json({ message: 'Request handled successfully' });
  } catch (error) {
    console.error('Error handling return request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getPendingRequests = async (req, res) => {
  try {
    res.render('admin/pending-requests');
  } catch (error) {
    console.error('Error rendering pending requests page:', error);
    res.status(500).render('error', { error: 'Internal server error' });
  }
};

const processWalletPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user.id;

    const order = await Order.findOne({ orderId, userId }).populate(
      'orderedItems.product'
    );
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: 'Order not found' });
    }

    if (order.paymentStatus !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Payment already processed or failed'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    if (!user.wallet || user.wallet.balance < order.finalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance'
      });
    }

    user.wallet.balance -= order.finalAmount;
    user.wallet.transactions.push({
      amount: order.finalAmount,
      type: 'debit',
      description: `Payment for order ${order.orderId}`,
      date: new Date()
    });

    await Wallet.create({
      userId: user._id,
      amount: order.finalAmount,
      type: 'debit',
      description: `Payment for order ${order.orderId}`,
      orderId: order.orderId
    });

    order.paymentStatus = 'Paid';
    order.paymentMethod = 'Wallet';
    order.isVisibleToAdmin = true;

    for (const item of order.orderedItems) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { quantity: -item.quantity }
      });
    }

    await trackStatusChange(
      order,
      order.status,
      `Payment completed using wallet for order ${order.orderId}`,
      user._id,
      'User'
    );

    await Promise.all([user.save(), order.save()]);

    res.status(200).json({
      success: true,
      message: 'Payment completed successfully using wallet',
      orderId: order.orderId
    });
  } catch (error) {
    console.error('Error processing wallet payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process wallet payment'
    });
  }
};

module.exports = {
  listOrders,
  viewOrderDetails,
  updateOrderStatus,
  processReturnRequest,
  processCancelRequest,
  downloadInvoice,
  getOrderStatusTimeline,
  generateInvoice,
  processCancelItemRequest,
  processReturnItemRequest,
  getOrderDetails,
  getRequestCounts,
  getCancelRequests,
  getReturnRequests,
  handleCancelRequest,
  handleReturnRequest,
  getPendingRequests,
  processWalletPayment
};