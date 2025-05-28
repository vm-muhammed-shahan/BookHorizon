const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const { v4: uuidv4 } = require("uuid");


const checkoutPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    const addressDoc = await Address.findOne({ userId });
    const validItems = cart.items.filter(item => {
      return item.productId
        && !item.productId.isBlocked
        && item.productId.status === "Available"
        && item.productId.quantity >= item.quantity;
    });

    if (validItems.length === 0) {
      return res.redirect("/cart");
    }

    const subTotal = validItems.reduce((acc, item) => acc + item.totalPrice, 0);
    const discount = 0; // Can extend later
    const shipping = 50;
    const tax = subTotal * 0.05;
    const finalAmount = subTotal - discount + tax + shipping;

    res.render("checkout", {
      user: req.session.user,
      addresses: addressDoc?.address || [],
      items: validItems,
      summary: {
        subTotal,
        tax,
        shipping,
        discount,
        finalAmount
      },

      shipping,
      grandTotal: finalAmount
    });
  } catch (error) {
    console.error("Checkout page error:", error);
    res.status(500).render("error", { message: "Error loading checkout page" });
  }
};





const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { selectedAddressIndex, paymentMethod } = req.body;

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      model: "Product"
    });

    console.log("Cart items:", JSON.stringify(cart?.items, null, 2));

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).send("Your cart is empty");
    }

    const validItems = cart.items.filter(item => {
      const isValid = item.productId &&
        item.productId.status === "Available" &&
        !item.productId.isBlocked &&
        item.productId.quantity >= item.quantity;
      console.log(`Item: ${item.productId?.productName}, Status: ${item.productId?.status}, isBlocked: ${item.productId?.isBlocked}, Stock: ${item.productId?.quantity}, Quantity: ${item.quantity}, Valid: ${isValid}`);
      return isValid;
    });

    console.log("Valid items:", JSON.stringify(validItems, null, 2));

    if (validItems.length === 0) {
      return res.status(400).send("No valid items in your cart. Please check product availability.");
    }

    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc || !addressDoc.address[selectedAddressIndex]) {
      return res.status(400).send("Invalid or missing address");
    }

    const selectedAddress = addressDoc.address[selectedAddressIndex];

    const subTotal = validItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = subTotal * 0.05;
    const shipping = 50;
    const discount = 0;
    const finalAmount = subTotal + tax + shipping - discount;

    const order = new Order({
      orderId: uuidv4(),
      orderedItems: validItems.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.price
      })),
      totalPrice: subTotal,
      discount,
      finalAmount,
      user: userId,
      address: selectedAddress,
      invoiceDate: new Date(),
      couponApplied: false,
      status: "Pending",
      paymentMethod: paymentMethod || "cod",
      shippingCharge: shipping,
      createdOn: new Date()
    });

    await order.save();

    for (let item of validItems) {
      await Product.findByIdAndUpdate(item.productId._id, {
        $inc: { quantity: -item.quantity }
      });
    }

    cart.items = [];
    await cart.save();

    res.redirect(`/order/success/${order.orderId}`);
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).send("Error placing order");
  }
};





const successPage = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderID })
      .populate({
        path: "orderedItems.product",
        model: "Product"
      });

    if (!order) {
      return res.status(404).send("Order not found");
    }

    res.render("order-Success", { order });
  } catch (error) {
    console.error("Error loading success page:", error);
    res.status(500).send("Failed to load order details");
  }
};


const editCheckout = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const addrId = req.query.addrId;
    const doc = await Address.findOne({ userId });
    const address = doc.address.id(addrId);
    if (!address) {
      return res.status(404).send("Address not found");
    }
    res.render("edit-address", { address });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};





module.exports = {
  checkoutPage,
  placeOrder,
  successPage,
  editCheckout,
}