const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");
const PDFDocument = require("pdfkit");
const path = require("path");

const getOrders = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const search = req.query.search || "";

    let query = { user: userId };
    if (search) {
      query.orderId = { $regex: search, $options: "i" };
    }

    const orders = await Order.find(query)
      .sort({ createdOn: -1 })
      .populate("orderedItems.product")
      .populate("user", "name email");

    // Handle missing users
    orders.forEach(order => {
      if (!order.user) {
        console.warn(`User not found for order ${order.orderId}`);
        order.user = { name: 'N/A', email: 'N/A' };
      }
    });

    // Fetch the user's wallet
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      // Create a new wallet if it doesn't exist
      wallet = new Wallet({
        user: userId,
        balance: 0,
        transactions: [],
      });
      await wallet.save();
    }

    console.log('User Orders:', orders);
    res.render("orders", { orders, search, user: req.session.user, wallet });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).render("error", { message: "Error fetching orders" });
  }
};

// Specific order detail
const getOrderDetail = async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log('Order ID:', orderId);
    const order = await Order.findOne({ orderId })
      .populate("orderedItems.product")
      .populate("user", "name email");
    console.log('Order Details:', order);
    if (!order) {
      req.session.message = { type: "error", text: "Order not found" };
      return res.redirect("/orders");
    }
    // Check if user exists
    if (!order.user) {
      console.warn(`User not found for order ${orderId}`);
      order.user = { name: 'N/A', email: 'N/A' };
    }
    // Pass the notification from the session to the template
    const notification = req.session.message || null;
    // Clear the notification from the session after rendering
    req.session.message = null;
    res.render("order-Detail", { 
      order, 
      user: req.session.user, 
      notification // Pass notification to the template
    });
  } catch (error) {
    console.error("Error in order listing", error);
    req.session.message = { type: "error", text: "Error fetching order details. Please try again." };
    res.redirect("/orders");
  }
};

// Fetch order status dynamically
const getOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId })
      .populate("orderedItems.product")
      .populate("user", "name email");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.status(200).json({
      success: true,
      order: {
        status: order.status,
        paymentStatus: order.paymentStatus,
        orderedItems: order.orderedItems.map(item => ({
          productId: item.product._id,
          cancelled: item.cancelled,
          cancelReason: item.cancelReason,
          returned: item.returned,
          returnReason: item.returnReason,
          returnStatus: item.returnStatus,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching order status:", error);
    res.status(500).json({ error: "Server error while fetching order status" });
  }
};

// Get wallet details for the user
const getWalletDetails = async (req, res) => {
  try {
    const userId = req.session.user._id;
    let wallet = await Wallet.findOne({ user: userId }).populate("user", "name email");

    if (!wallet) {
      // Create a new wallet if it doesn't exist
      wallet = new Wallet({
        user: userId,
        balance: 0,
        transactions: [],
      });
      await wallet.save();
    }

    res.render("wallet", { wallet, user: req.session.user });
  } catch (error) {
    console.error("Error fetching wallet details:", error);
    res.status(500).render("page-404", { message: "Error fetching wallet details" });
  }
};

// Cancel item or full order
const cancelOrder = async (req, res) => {
  try {
    const { orderId, productId, reason } = req.body;
    const order = await Order.findOne({ orderId }).populate('orderedItems.product');
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.status !== 'Pending' && order.status !== 'Processing' && order.status !== 'Shipped') {
      return res.status(400).json({ error: 'Cannot cancel order in this status' });
    }

    let refundAmount = 0;

    if (productId) {
      const itemIndex = order.orderedItems.findIndex(i => i.product._id.toString() === productId);
      if (itemIndex === -1) {
        return res.status(404).json({ error: 'Item not found in order' });
      }
      const item = order.orderedItems[itemIndex];
      if (item.cancelled) {
        return res.status(400).json({ error: 'Item already cancelled' });
      }
      // Increment product stock
      await Product.findByIdAndUpdate(item.product._id, { $inc: { quantity: item.quantity } });
      // Mark item as cancelled and save reason
      item.cancelled = true;
      item.cancelReason = reason || 'No reason provided';
      refundAmount = item.price * item.quantity;
      order.totalPrice -= refundAmount;
      order.finalAmount = order.totalPrice + order.shippingCharge - order.discount;

      // Check if all items are cancelled
      const allCancelled = order.orderedItems.every(i => i.cancelled);
      if (allCancelled) {
        order.status = 'Cancelled';
        order.cancelReason = reason || 'No reason provided';
        order.paymentStatus = 'Failed';
      }
    } else {
      // Cancel entire order
      if (order.status === 'Cancelled') {
        return res.status(400).json({ error: 'Order already cancelled' });
      }

      // Increment stock for all items
      for (const item of order.orderedItems) {
        if (!item.cancelled) {
          await Product.findByIdAndUpdate(item.product._id, { $inc: { quantity: item.quantity } });
          item.cancelled = true;
          item.cancelReason = reason || 'No reason provided';
          refundAmount += item.price * item.quantity;
        }
      }

      order.status = 'Cancelled';
      order.cancelReason = reason || 'No reason provided';
      order.paymentStatus = 'Failed';
    }

    // Refund to wallet
    if (refundAmount > 0) {
      let wallet = await Wallet.findOne({ user: order.user });
      if (!wallet) {
        wallet = new Wallet({
          user: order.user,
          balance: refundAmount,
          transactions: [{
            type: "credit",
            amount: refundAmount,
            description: `Refund for ${productId ? 'item in ' : ''}order ${order.orderId} (Cancelled)`,
            date: new Date()
          }],
        });
      } else {
        wallet.balance += refundAmount;
        wallet.transactions.push({
          type: "credit",
          amount: refundAmount,
          description: `Refund for ${productId ? 'item in ' : ''}order ${order.orderId} (Cancelled)`,
          date: new Date()
        });
      }
      await wallet.save();
    }

    await order.save();
    return res.status(200).json({ 
      success: true, 
      message: `Item${productId ? '' : 's'} cancelled successfully. Refund of ₹${refundAmount.toFixed(2)} credited to your wallet.` 
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return res.status(500).json({ error: 'Server error while cancelling order' });
  }
};

// Return item
const returnOrder = async (req, res) => {
  try {
    const { orderId, productId, reason } = req.body;
    const order = await Order.findOne({ orderId }).populate('orderedItems.product');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'Delivered') {
      return res.status(400).json({ error: 'Can only return delivered orders' });
    }

    const itemIndex = order.orderedItems.findIndex(i => i.product._id.toString() === productId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in order' });
    }

    const item = order.orderedItems[itemIndex];
    if (item.returned && item.returnStatus === 'approved') {
      return res.status(400).json({ error: 'Item already returned and approved' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'Return reason is mandatory' });
    }

    // Mark item as return requested
    item.returned = true;
    item.returnReason = reason;
    item.returnStatus = 'pending';

    // Check if any items have a pending return request
    const hasPendingReturns = order.orderedItems.some(i => i.returnStatus === 'pending');
    if (hasPendingReturns) {
      order.status = 'Return Request';
      order.paymentStatus = 'Pending';
    }

    await order.save();
    return res.status(200).json({ success: true, message: 'Return request submitted successfully' });
  } catch (error) {
    console.error('Error submitting return request:', error);
    return res.status(500).json({ error: 'Server error while submitting return request' });
  }
};

// Download invoice
const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId }).populate("orderedItems.product");

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    
    // Enhanced headers with proper encoding
    res.setHeader("Content-disposition", `attachment; filename=invoice-${order.orderId}.pdf`);
    res.setHeader("Content-type", "application/pdf; charset=utf-8");
    res.setHeader("Content-Transfer-Encoding", "binary");

    doc.pipe(res);

    // Page configuration
    const margin = 40;
    const pageWidth = 595.28;
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = margin;

    // Helper functions
    const moveDown = (space = 15) => {
      yPosition += space;
    };

    const drawLine = (y = yPosition, thickness = 0.5) => {
      doc.lineWidth(thickness)
         .strokeColor('#cccccc')
         .moveTo(margin, y)
         .lineTo(pageWidth - margin, y)
         .stroke();
    };

    const addText = (text, x, y, options = {}) => {
      return doc.text(text, x, y, options);
    };

    // Helper function to format currency with Indian Rupee symbol
    const formatCurrency = (amount) => `Rs ${amount.toFixed(2)}`;
    

    // Header
    doc.fontSize(28)
       .font('Helvetica-Bold')
       .fillColor('#2c3e50')
       .text('BookHorizon', margin, yPosition);
    
    moveDown(25);
    
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#7f8c8d')
       .text('Premium Book Store', margin, yPosition);

    // Invoice title - right aligned
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fillColor('#2c3e50')
       .text('INVOICE', margin, margin, { align: 'right', width: contentWidth });

    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#7f8c8d')
       .text(`#${order.orderId}`, margin, margin + 25, { align: 'right', width: contentWidth });

    moveDown(40);
    drawLine();
    moveDown(25);

    // DATE SECTION - Two columns
    const leftColX = margin;
    const rightColX = margin + (contentWidth * 0.6);

    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('#2c3e50')
       .text('Invoice Date:', leftColX, yPosition);

    doc.font('Helvetica')
       .fillColor('#34495e')
       .text(new Date().toLocaleDateString('en-US', { 
         year: 'numeric', 
         month: 'long', 
         day: 'numeric' 
       }), leftColX + 80, yPosition);

    doc.font('Helvetica-Bold')
       .fillColor('#2c3e50')
       .text('Order Date:', rightColX, yPosition);

    doc.font('Helvetica')
       .fillColor('#34495e')
       .text(order.createdOn.toLocaleDateString('en-US', { 
         year: 'numeric', 
         month: 'long', 
         day: 'numeric' 
       }), rightColX + 80, yPosition);

    moveDown(30);

    // ORDER DETAILS & ADDRESS SECTION
    const sectionY = yPosition;

    // Left section - Order Details
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('#2c3e50')
       .text('Order Details', leftColX, sectionY);

    moveDown(20);

    const detailsData = [
      ['Status:', order.status],
      ['Payment:', order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'],
      ['Payment Status:', order.paymentStatus]
    ];

    detailsData.forEach((detail, index) => {
      const detailY = sectionY + 20 + (index * 18);
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#7f8c8d')
         .text(detail[0], leftColX, detailY);
      
      doc.font('Helvetica-Bold')
         .fillColor('#34495e')
         .text(detail[1], leftColX + 100, detailY);
    });

    // Right section - Delivery Address
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('#2c3e50')
       .text('Delivery Address', rightColX, sectionY);

    const addressLines = [
      order.address.name,
      order.address.landMark,
      `${order.address.city}, ${order.address.state}`,
      `PIN: ${order.address.pincode}`,
      `Phone: ${order.address.phone}`
    ];

    if (order.address.altPhone) {
      addressLines.push(`Alt: ${order.address.altPhone}`);
    }

    addressLines.forEach((line, index) => {
      const lineY = sectionY + 20 + (index * 15);
      doc.fontSize(11)
         .font(index === 0 ? 'Helvetica-Bold' : 'Helvetica')
         .fillColor(index === 0 ? '#2c3e50' : '#7f8c8d')
         .text(line, rightColX, lineY);
    });

    moveDown(120);
    drawLine();
    moveDown(25);

    // ITEMS TABLE
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .fillColor('#2c3e50')
       .text('Items Ordered', margin, yPosition);

    moveDown(20);

    // Table header
    const tableHeaderY = yPosition;
    const colPositions = {
      product: margin,
      qty: margin + 280,
      price: margin + 350,
      total: margin + 420
    };
    const colWidths = {
      product: 270,
      qty: 60,
      price: 60,
      total: 80
    };

    // Header background
    doc.rect(margin, tableHeaderY, contentWidth, 25)
       .fillColor('#ecf0f1')
       .fill();

    // Header text
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('#2c3e50');

    doc.text('Product', colPositions.product + 5, tableHeaderY + 8);
    doc.text('Qty', colPositions.qty, tableHeaderY + 8, { width: colWidths.qty, align: 'center' });
    doc.text('Price', colPositions.price, tableHeaderY + 8, { width: colWidths.price, align: 'right' });
    doc.text('Total', colPositions.total, tableHeaderY + 8, { width: colWidths.total, align: 'right' });

    moveDown(35);

    // Table rows
    order.orderedItems.forEach((item, index) => {
      const rowY = yPosition;
      const rowHeight = 30;

      // Alternate row background
      if (index % 2 === 0) {
        doc.rect(margin, rowY, contentWidth, rowHeight)
           .fillColor('#fafafa')
           .fill();
      }

      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#2c3e50');

      // Product name (truncate if needed)
      let productName = item.product.productName;
      if (productName.length > 40) {
        productName = productName.substring(0, 37) + '...';
      }

      doc.text(productName, colPositions.product + 5, rowY + 8);
      doc.text(item.quantity.toString(), colPositions.qty, rowY + 8, { 
        width: colWidths.qty, 
        align: 'center' 
      });
      doc.text(formatCurrency(item.price), colPositions.price, rowY + 8, { 
        width: colWidths.price, 
        align: 'right' 
      });
      doc.text(formatCurrency(item.price * item.quantity), colPositions.total, rowY + 8, { 
        width: colWidths.total, 
        align: 'right' 
      });

      // Status indicators
      if (item.cancelled) {
        doc.fontSize(9)
           .fillColor('#e74c3c')
           .text(`Cancelled${item.cancelReason ? ': ' + item.cancelReason : ''}`, colPositions.product + 5, rowY + 20);
      } else if (item.returned) {
        doc.fontSize(9)
           .fillColor('#e74c3c');
        let statusText = '';
        if (item.returnStatus === 'pending') {
          statusText = `Return Requested: ${item.returnReason}`;
        } else if (item.returnStatus === 'approved') {
          statusText = `Returned: ${item.returnReason}`;
        } else if (item.returnStatus === 'rejected') {
          statusText = `Return Rejected: ${item.returnReason}`;
        }
        doc.text(`(${statusText})`, colPositions.product + 5, rowY + 20);
      }

      moveDown(rowHeight);
    });

    drawLine(yPosition, 1);
    moveDown(25);

    // SUMMARY SECTION
    const summaryX = margin + contentWidth - 200;
    const summaryY = yPosition;

    const summaryItems = [
      ['Subtotal:', formatCurrency(order.totalPrice)],
      ['Shipping:', formatCurrency(order.shippingCharge)]
    ];

    if (order.discount > 0) {
      summaryItems.push(['Discount:', `-${formatCurrency(order.discount)}`]);
    }

    summaryItems.forEach((item, index) => {
      const itemY = summaryY + (index * 20);
      doc.fontSize(12)
         .font('Helvetica')
         .fillColor('#7f8c8d')
         .text(item[0], summaryX, itemY);
      
      doc.text(item[1], summaryX + 100, itemY, { width: 80, align: 'right' });
    });

    const totalY = summaryY + (summaryItems.length * 20) + 10;
    
    // Total line
    doc.lineWidth(1)
       .strokeColor('#bdc3c7')
       .moveTo(summaryX, totalY)
       .lineTo(summaryX + 180, totalY)
       .stroke();

    // Final total
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('#2c3e50')
       .text('Total:', summaryX, totalY + 15);
    
    doc.text(formatCurrency(order.finalAmount), summaryX + 100, totalY + 15, { 
      width: 80, 
      align: 'right' 
    });

    // FOOTER
    const footerY = pageWidth - 80;
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#95a5a6')
       .text(
         'Thank you for choosing BookHorizon! We appreciate your business.',
         margin,
         footerY,
         { align: 'center', width: contentWidth }
       );
    doc.fontSize(9)
       .text(
         'For support queries, please contact our customer service team.',
         margin,
         footerY + 15,
         { align: 'center', width: contentWidth }
       );
    doc.end();
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Error generating invoice');
  }
};

module.exports = {
  downloadInvoice,
  returnOrder,
  cancelOrder,
  getOrderDetail,
  getOrders,
  getWalletDetails,
  getOrderStatus,
};