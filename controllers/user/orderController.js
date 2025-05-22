// controllers/orderController.js
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const PDFDocument = require("pdfkit");
const path = require("path");




// GET: List user orders
const getOrders = async (req, res) => {
  const userId = req.session.user._id;
  const orders = await Order.find({ userId }).sort({ createdOn: -1 }).populate("orderedItems.product");
  res.render("orders", { orders });
};

// GET: Specific order detail
const getOrderDetail = async (req, res) => {
  const { orderId } = req.params;
  const order = await Order.findOne({ orderId }).populate("orderedItems.product");
  res.render("order-detail", { order });
};

// POST: Cancel item or full order
const cancelOrder = async (req, res) => {
  const { orderId, productId, reason } = req.body;
  const order = await Order.findOne({ orderId });

  const itemIndex = order.orderedItems.findIndex(i => i.product.toString() === productId);
  if (itemIndex !== -1) {
    const item = order.orderedItems[itemIndex];
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
    order.orderedItems.splice(itemIndex, 1);
    if (order.orderedItems.length === 0) {
      order.status = "Cancelled";
    }
    await order.save();
  }
  res.redirect("/orders");
};

// POST: Return item
const returnOrder = async (req, res) => {
  const { orderId, productId, reason } = req.body;
  const order = await Order.findOne({ orderId });
  order.status = "REturn Request"; // typo preserved from your schema
  await order.save();
  res.redirect("/orders");
};

// GET: Download invoice
const downloadInvoice = async (req, res) => {
  const { orderId } = req.params;
  const order = await Order.findOne({ orderId }).populate("orderedItems.product");
  const doc = new PDFDocument();
  res.setHeader("Content-disposition", `attachment; filename=invoice-${orderId}.pdf`);
  res.setHeader("Content-type", "application/pdf");
  doc.text(`Invoice - Order #${order.orderId}`, { align: 'center' });
  order.orderedItems.forEach(item => {
    doc.text(`${item.product.name} x${item.quantity} - ₹${item.price}`);
  });
  doc.text(`Total: ₹${order.finalAmount}`);
  doc.end();
  doc.pipe(res);
};







module.exports={
  downloadInvoice,
  returnOrder,
  cancelOrder,
  getOrderDetail,
  getOrders,
}