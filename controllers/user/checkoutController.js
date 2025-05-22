const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const { v4: uuidv4 } = require("uuid");





const checkoutPage = async (req, res) => {
  const userId = req.session.user._id;
  const cart = await Cart.findOne({ userId }).populate("items.productId");
  const addressDoc = await Address.findOne({ userId });

  const validItems = cart.items.filter(item => {
    return item.productId?.isListed && !item.productId.isBlocked && item.productId.stock >= item.quantity;
  });

  const subTotal = validItems.reduce((acc, item) => acc + item.totalPrice, 0);
  const discount = 0; // Can extend later
  const shipping = 50;
  const tax = subTotal * 0.05;
  const finalAmount = subTotal - discount + tax + shipping;

  res.render("user/checkout", {
    addresses: addressDoc?.address || [],
    cartItems: validItems,
    subTotal,
    tax,
    shipping,
    discount,
    finalAmount
  });
};

const placeOrder = async (req, res) => {
  const userId = req.session.user._id;
  const { selectedAddressIndex } = req.body;
  const cart = await Cart.findOne({ userId }).populate("items.productId");
  const addressDoc = await Address.findOne({ userId });

  const validItems = cart.items.filter(item =>
    item.productId?.isListed && !item.productId.isBlocked && item.productId.stock >= item.quantity
  );

  const subTotal = validItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const tax = subTotal * 0.05;
  const shipping = 50;
  const discount = 0; // If any coupon logic
  const finalAmount = subTotal + tax + shipping - discount;

  const order = new Order({
    orderedItems: validItems.map(item => ({
      product: item.productId._id,
      quantity: item.quantity,
      price: item.price
    })),
    totalPrice: subTotal,
    discount,
    finalAmount,
    address: addressDoc._id,
    invoiceDate: new Date(),
    userId,
    couponApplied: false,
    status: "Pending"
  });

  await order.save();

  for (let item of validItems) {
    await Product.findByIdAndUpdate(item.productId._id, {
      $inc: { stock: -item.quantity }
    });
  }

  cart.items = [];
  await cart.save();

  res.redirect(`/order/success/${order.orderId}`);
};

const successPage = (req, res) => {
  res.render("order-success", { orderID: req.params.orderID });
};









module.exports={
  checkoutPage,
  placeOrder,
  successPage
}