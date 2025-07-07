const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Coupon = require("../../models/couponSchema");
const Razorpay = require("razorpay");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const checkoutPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    const addressDoc = await Address.findOne({ userId });
    const validItems = cart.items.filter(
      (item) =>
        item.productId &&
        !item.productId.isBlocked &&
        item.productId.status === "Available" &&
        item.productId.quantity >= item.quantity
    );

    if (validItems.length === 0) {
      return res.redirect("/cart");
    }

    const subTotal = validItems.reduce((acc, item) => acc + item.totalPrice, 0);
    let discount = 0;
    if (cart.coupon?.couponId) {
      const coupon = await Coupon.findById(cart.coupon.couponId);
      if (coupon) {
        discount = (subTotal * coupon.discountPercentage) / 100;
        if (discount > subTotal) discount = subTotal; // Ensure discount doesn't exceed subtotal
      }
    }
    const shipping = 50;
    const tax = subTotal * 0.05;
    const finalAmount = subTotal - discount + tax + shipping;

    // Fetch available coupons
    const currentDate = new Date();
    const availableCoupons = await Coupon.find({
      islist: true,
      expireOn: { $gt: currentDate },
      userId: { $ne: userId },
      minimumPrice: { $lte: subTotal },
    });

    res.render("checkout", {
      user: req.session.user,
      addresses: addressDoc?.address || [],
      items: validItems,
      summaryItems: {
        subtotal: subTotal,
        tax,
        shipping,
        discount,
        totalPrice: finalAmount,
      },
      couponApplied: cart.coupon?.couponId ? true : false,
      couponName: cart.coupon?.couponName || "",
      availableCoupons: availableCoupons,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Checkout page error:", error);
    res.status(500).render("error", { message: "Error loading checkout page" });
  }
}



const applyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;
    const userId = req.session.user._id;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const validItems = cart.items.filter(
      (item) =>
        item.productId &&
        !item.productId.isBlocked &&
        item.productId.status === "Available" &&
        item.productId.quantity >= item.quantity
    );

    if (validItems.length === 0) {
      return res.status(400).json({ error: "No valid items in cart" });
    }

    const subTotal = validItems.reduce((acc, item) => acc + item.totalPrice, 0);
    const coupon = await Coupon.findOne({ name: couponCode, islist: true });

    if (!coupon) {
      return res.status(400).json({ error: "Invalid coupon code" });
    }

    if (new Date(coupon.expireOn) < new Date()) {
      return res.status(400).json({ error: "Coupon has expired" });
    }

    if (subTotal < coupon.minimumPrice) {
      return res.status(400).json({ error: `Minimum purchase of ₹${coupon.minimumPrice.toFixed(2)} required` });
    }

    if (coupon.userId.includes(userId)) {
      return res.status(400).json({ error: "Coupon already used by you" });
    }

    const discount = (subTotal * coupon.discountPercentage) / 100;
    if (discount >= subTotal) {
      return res.status(400).json({ error: "Discount cannot exceed or equal the cart total" });
    }

    const tax = subTotal * 0.05;
    const shipping = 50;
    const finalAmount = subTotal - discount + tax + shipping;

    cart.coupon = {
      couponId: coupon._id,
      discount: discount,
      couponName: coupon.name,
    };
    await cart.save();

    return res.json({
      success: true,
      summary: {
        subtotal: subTotal,
        tax,
        shipping,
        discount,
        totalPrice: finalAmount,
      },
      couponName: coupon.name,
    });
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ error: "Server error while applying coupon" });
  }
};



const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.user._id;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    if (!cart.coupon?.couponId) {
      return res.status(400).json({ error: "No coupon applied" });
    }

    const validItems = cart.items.filter(
      (item) =>
        item.productId &&
        !item.productId.isBlocked &&
        item.productId.status === "Available" &&
        item.productId.quantity >= item.quantity
    );

    if (validItems.length === 0) {
      return res.status(400).json({ error: "No valid items in cart" });
    }

    const subTotal = validItems.reduce((acc, item) => acc + item.totalPrice, 0);
    const tax = subTotal * 0.05;
    const shipping = 50;
    const discount = 0;
    const finalAmount = subTotal - discount + tax + shipping;

    cart.coupon = {
      couponId: null,
      discount: 0,
      couponName: "",
    };
    await cart.save();

    return res.json({
      success: true,
      summary: {
        subtotal: subTotal,
        tax,
        shipping,
        discount,
        totalPrice: finalAmount,
      },
    });
  } catch (error) {
    console.error("Error removing coupon:", error);
    res.status(500).json({ error: "Server error while removing coupon" });
  }
};

const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { selectedAddressIndex, paymentMethod } = req.body;

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      model: "Product",
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ error: "Your cart is empty" });
    }

    const validItems = cart.items.filter(
      (item) =>
        item.productId &&
        item.productId.status === "Available" &&
        !item.productId.isBlocked &&
        item.productId.quantity >= item.quantity
    );

    if (validItems.length === 0) {
      return res
        .status(400)
        .json({ error: "No valid items in your cart. Please check product availability." });
    }

    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc || !addressDoc.address[selectedAddressIndex]) {
      return res.status(400).json({ error: "Invalid or missing address" });
    }

    const selectedAddress = addressDoc.address[selectedAddressIndex];
    const subTotal = validItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = subTotal * 0.05;
    const shipping = 50;
    const discount = cart.coupon?.discount || 0;
    const finalAmount = subTotal + tax + shipping - discount;

    let razorpayOrder = null;
    if (paymentMethod === "razorpay") {
      const receipt = `rcpt_${uuidv4().replace(/-/g, "").slice(0, 32)}`;
      try {
        razorpayOrder = await razorpay.orders.create({
          amount: Math.round(finalAmount * 100),
          currency: "INR",
          receipt,
        });
      } catch (razorpayError) {
        console.error("Razorpay error:", razorpayError);
        return res.status(400).json({ error: `Failed to create Razorpay order: ${razorpayError.error?.description || "Unknown error"}` });
      }
    }

    const order = new Order({
      orderId: uuidv4(),
      orderedItems: validItems.map((item) => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.price,
      })),
      totalPrice: subTotal,
      discount,
      finalAmount,
      user: userId,
      address: selectedAddress,
      invoiceDate: new Date(),
      couponApplied: cart.coupon?.couponId ? true : false,
      couponId: cart.coupon?.couponId || null,
      status: "Pending",
      paymentMethod: paymentMethod || "cod",
      paymentStatus: paymentMethod === "razorpay" ? "Pending" : "Pending",
      shippingCharge: shipping,
      razorpayOrderId: paymentMethod === "razorpay" ? razorpayOrder.id : null,
    });

    await order.save();

    if (cart.coupon?.couponId && paymentMethod === "cod") {
      const coupon = await Coupon.findById(cart.coupon.couponId);
      if (coupon && !coupon.userId.includes(userId)) {
        coupon.userId.push(userId);
        await coupon.save();
      }
    }

    if (paymentMethod === "cod") {
      for (let item of validItems) {
        await Product.findByIdAndUpdate(item.productId._id, {
          $inc: { quantity: -item.quantity },
        });
      }
      cart.items = [];
      cart.coupon = { couponId: null, discount: 0, couponName: "" };
      await cart.save();
      return res.json({ redirect: `/order/success/${order.orderId}` });
    }

    res.json({
      orderId: order.orderId,
      razorpayOrderId: razorpayOrder.id,
      amount: finalAmount * 100,
      currency: "INR",
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ error: "Error creating order" });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature === razorpay_signature) {
      order.paymentStatus = "Completed";
      order.status = "Processing";
      
      if (order.couponApplied && order.couponId) {
        const coupon = await Coupon.findById(order.couponId);
        if (coupon && !coupon.userId.includes(order.user)) {
          coupon.userId.push(order.user);
          await coupon.save();
        }
      }

      await order.save();

      const cart = await Cart.findOne({ userId: order.user }).populate("items.productId");
      for (let item of cart.items) {
        await Product.findByIdAndUpdate(item.productId._id, {
          $inc: { quantity: -item.quantity },
        });
      }
      cart.items = [];
      cart.coupon = { couponId: null, discount: 0, couponName: "" };
      await cart.save();

      res.json({ success: true, redirect: `/order/success/${order.orderId}` });
    } else {
      order.paymentStatus = "Failed";
      await order.save();
      res.json({ success: false, redirect: `/order/failure/${order.orderId}` });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ error: "Server error during payment verification" });
  }
};


const retryPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.session.user._id;

    const order = await Order.findOne({ orderId, user: userId });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.paymentMethod !== "razorpay" || order.paymentStatus !== "Failed") {
      return res.status(400).json({ error: "Cannot retry payment for this order" });
    }

    const receipt = `rcpt_${uuidv4().replace(/-/g, "").slice(0, 32)}`;
    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: Math.round(order.finalAmount * 100),
        currency: "INR",
        receipt,
      });
    } catch (razorpayError) {
      console.error("Razorpay retry error:", razorpayError);
      return res.status(400).json({ error: `Failed to create Razorpay order: ${razorpayError.error?.description || "Unknown error"}` });
    }

    order.razorpayOrderId = razorpayOrder.id;
    order.paymentStatus = "Pending";
    await order.save();

    res.json({
      orderId: order.orderId,
      razorpayOrderId: razorpayOrder.id,
      amount: order.finalAmount * 100,
      currency: "INR",
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Error retrying payment:", error);
    res.status(500).json({ error: "Error retrying payment" });
  }
};

const paymentFailed = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.session.user._id;

    const order = await Order.findOne({ orderId, user: userId });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.paymentMethod !== "razorpay") {
      return res.status(400).json({ error: "Invalid payment method for this order" });
    }

    order.paymentStatus = "Failed";
    await order.save();

    res.json({ success: true, redirect: `/order/failure/${order.orderId}` });
  } catch (error) {
    console.error("Error handling payment failure:", error);
    res.status(500).json({ error: "Error processing payment failure" });
  }
};

const successPage = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderID }).populate({
      path: "orderedItems.product",
      model: "Product",
    });

    if (!order) {
      return res.status(404).send("Order not found");
    }

    res.render("order-success", { order });
  } catch (error) {
    console.error("Error loading success page:", error);
    res.status(500).send("Failed to load order details");
  }
};

const failurePage = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderID }).populate({
      path: "orderedItems.product",
      model: "Product",
    });

    if (!order) {
      return res.status(404).send("Order not found");
    }

    res.render("order-failure", { order });
  } catch (error) {
    console.error("Error loading failure page:", error);
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
    console.error("Error loading edit address:", error);
    res.status(500).send("Server Error");
  }
};






module.exports = {
  checkoutPage,
  applyCoupon,
  removeCoupon,
  createRazorpayOrder,
  verifyPayment,
  retryPayment,
  paymentFailed,
  successPage,
  failurePage,
  editCheckout,
 
};