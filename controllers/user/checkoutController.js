const Cart = require("../../models/cartSchema");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Wallet = require("../../models/walletSchema");
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
    const cart = await Cart.findOne({ userId }).populate({
    path: "items.productId",
    populate: { path: "category" } // populate category here
  });


    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }


    if (!cart || cart.items.length === 0) {
      const userData = await User.findOne({ _id: userId });
      return res.render("checkout", {
        user: userData,
        message: "Your cart is empty.",
        subtotal: 0,
        walletBalance: 0,
        isWalletPaymentEnabled: false,
      });
    }

    const validItems = cart.items.filter(
      (item) =>
        item.productId &&
        !item.productId.isBlocked &&
        item.productId.status === "Available" &&
        item.productId.quantity > 0 &&
        item.quantity > 0 &&
        item.productId.category?.isListed !== false 
    );

    if (validItems.length === 0) {
      const userData = await User.findOne({ _id: userId });
      return res.render("checkout", {
        user: userData,
        message: "All items in your cart are out of stock or have zero quantity.",
        items: [],
        subtotal: 0,
        walletBalance: 0,
        isWalletPaymentEnabled: false,
      });
    }

    const addressDoc = await Address.findOne({ userId });
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = new Wallet({
        user: userId,
        balance: 0,
        transactions: [],
      });
      await wallet.save();
    }

    const subTotal = validItems.reduce((acc, item) => acc + item.totalPrice, 0);

    let discount = 0;
    if (cart.coupon?.couponId) {
      const coupon = await Coupon.findById(cart.coupon.couponId);
      if (coupon) {
        const preTaxTotal = subTotal;
        const tax = preTaxTotal * 0.05;
        const shipping = 50;
        const totalBeforeDiscount = preTaxTotal + tax + shipping;
        discount = (totalBeforeDiscount * coupon.discountPercentage) / 100;
        if (discount > totalBeforeDiscount) discount = totalBeforeDiscount;
      }
    }
    const shipping = 50;
    const tax = subTotal * 0.05;
    const totalBeforeDiscount = subTotal + tax + shipping;
    const finalAmount = totalBeforeDiscount - discount;

    const isWalletPaymentEnabled = wallet.balance >= finalAmount;

    const currentDate = new Date();
    const availableCoupons = await Coupon.find({
      islist: true,
      expireOn: { $gt: currentDate },
      userId: { $ne: userId },
      minimumPrice: { $lte: subTotal },
    });

    const userData = await User.findOne({ _id: userId });

    res.render("checkout", {
      user: userData,
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
      subtotal: subTotal,
      walletBalance: wallet.balance,
      isWalletPaymentEnabled,
    });
  } catch (error) {
    console.error("Checkout page error:", error);
    res.status(500).render("error", { message: "Error loading checkout page" });
  }
};


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

    const preTaxTotal = subTotal;
    const tax = preTaxTotal * 0.05;
    const shipping = 50;
    const totalBeforeDiscount = preTaxTotal + tax + shipping;
    const discount = (totalBeforeDiscount * coupon.discountPercentage) / 100;
    if (discount >= totalBeforeDiscount) {
      return res.status(400).json({ error: "Discount cannot exceed or equal the cart total" });
    }

    const finalAmount = totalBeforeDiscount - discount;

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

    const allItems = cart.items;
    const validItems = [];
    const outOfStockItems = [];

    for (const item of allItems) {
      if (
        item.productId &&
        item.productId.status === "Available" &&
        !item.productId.isBlocked &&
        item.productId.quantity >= item.quantity &&
        item.quantity > 0
      ) {
        validItems.push(item);
      } else {
        outOfStockItems.push(item);
      }
    }

    if (validItems.length === 0) {
      return res.status(400).json({
        error: "No valid items in your cart. Please check product availability.",
      });
    }

    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc || !addressDoc.address[selectedAddressIndex]) {
      return res.status(400).json({ error: "Invalid or missing address" });
    }

    const selectedAddress = addressDoc.address[selectedAddressIndex];
    const subTotal = validItems.reduce((sum, item) => sum + item.totalPrice, 0);

    if (paymentMethod === "cod" && subTotal > 1000) {
      return res.status(400).json({
        error: "Cash on Delivery is not available for orders above ₹1000",
      });
    }

    const tax = subTotal * 0.05;
    const shipping = 50;

    let discount = 0;
    if (cart.coupon?.couponId) {
      const coupon = await Coupon.findById(cart.coupon.couponId);
      if (
        coupon &&
        coupon.islist &&
        new Date(coupon.expireOn) > new Date() &&
        subTotal >= coupon.minimumPrice
      ) {
        const preTaxTotal = subTotal;
        const totalBeforeDiscount = preTaxTotal + tax + shipping;
        discount = (totalBeforeDiscount * coupon.discountPercentage) / 100;
        if (discount > totalBeforeDiscount) discount = totalBeforeDiscount;
      } else {
        cart.coupon = { couponId: null, discount: 0, couponName: "" };
        await cart.save();
      }
    }

    const finalAmount = subTotal + tax + shipping - discount;

    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = new Wallet({
        user: userId,
        balance: 0,
        transactions: [],
      });
      await wallet.save();
    }

    let walletAmountUsed = 0;
    let razorpayOrder = null;
    let effectivePaymentMethod = paymentMethod;

    if (paymentMethod === "wallet") {
      if (wallet.balance >= finalAmount) {
        walletAmountUsed = finalAmount;
        effectivePaymentMethod = "wallet";

        wallet.balance -= walletAmountUsed;
        wallet.transactions.push({
          type: "debit",
          amount: walletAmountUsed,
          description: `Payment for order ${uuidv4()}`,
          date: new Date(),
        });
        await wallet.save();
      } else {
        return res.status(400).json({
          error: "Insufficient wallet balance for this order",
        });
      }
    } else if (paymentMethod === "razorpay") {
      const receipt = `rcpt_${uuidv4().replace(/-/g, "").slice(0, 32)}`;
      try {
        razorpayOrder = await razorpay.orders.create({
          amount: Math.round(finalAmount * 100),
          currency: "INR",
          receipt,
        });
      } catch (razorpayError) {
        console.error("Razorpay error:", razorpayError);
        return res.status(400).json({
          error: `Failed to create Razorpay order: ${razorpayError.error?.description || "Unknown error"
            }`,
        });
      }
    }

    const order = new Order({
      orderedItems: validItems.map((item) => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.price,
      })),
      totalPrice: subTotal,
      discount,
      finalAmount,
      walletAmount: walletAmountUsed,
      user: userId,
      address: selectedAddress,
      invoiceDate: new Date(),
      couponApplied: cart.coupon?.couponId ? true : false,
      couponId: cart.coupon?.couponId || null,
      status: "Pending",
      paymentMethod: effectivePaymentMethod,
      paymentStatus:
        effectivePaymentMethod === "cod"
          ? "Pending"
          : effectivePaymentMethod === "wallet"
            ? "Completed"
            : "Pending",
      shippingCharge: shipping,
      razorpayOrderId: razorpayOrder ? razorpayOrder.id : null,
    });
    await order.save();

    if (effectivePaymentMethod === "cod" || effectivePaymentMethod === "wallet") {
      if (cart.coupon?.couponId) {
        const coupon = await Coupon.findById(cart.coupon.couponId);
        if (coupon && !coupon.userId.includes(userId)) {
          coupon.userId.push(userId);
          await coupon.save();
        }
      }

      for (const item of validItems) {
        await Product.findByIdAndUpdate(item.productId._id, {
          $inc: { quantity: -item.quantity },
        });
      }

      cart.items = [];
      cart.coupon = { couponId: null, discount: 0, couponName: "" };
      await cart.save();

      res.json({ success: true, redirect: `/order/success/${order.orderId}` });
    } else {
      res.json({
        orderId: order.orderId,
        razorpayOrderId: razorpayOrder.id,
        amount: finalAmount * 100,
        currency: "INR",
        key: process.env.RAZORPAY_KEY_ID,
      });
    }
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ error: "Error creating order" });
  }
};


const clearCartAfterOrder = async (cart, validItems, outOfStockItems) => {
  try {

    for (let item of validItems) {
      await Product.findByIdAndUpdate(item.productId._id, {
        $inc: { quantity: -item.quantity },
      });
    }

    cart.items = cart.items.filter(item => outOfStockItems.some(out => out.productId.toString() === item.productId.toString()));
    cart.coupon = { couponId: null, discount: 0, couponName: "" };
    await cart.save();
  } catch (error) {
    console.error("Error clearing cart after order:", error);
    throw error;
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

      for (const item of order.orderedItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { quantity: -item.quantity },
        });
      }

      const cart = await Cart.findOne({ userId: order.user });
      if (cart) {
        cart.items = [];
        cart.coupon = { couponId: null, discount: 0, couponName: "" };
        await cart.save();
      }

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

    if (order.paymentMethod !== "razorpay") {
      return res.status(400).json({ error: "Cannot retry payment for this order" });
    }

    if (order.walletAmount > 0) {
      let wallet = await Wallet.findOne({ user: userId });
      if (!wallet) {
        wallet = new Wallet({
          user: userId,
          balance: order.walletAmount,
          transactions: [
            {
              type: "credit",
              amount: order.walletAmount,
              description: `Refund for failed payment retry of order ${order.orderId}`,
              date: new Date(),
            },
          ],
        });
      } else {
        wallet.balance += order.walletAmount;
        wallet.transactions.push({
          type: "credit",
          amount: order.walletAmount,
          description: `Refund for failed payment retry of order ${order.orderId}`,
          date: new Date(),
        });
      }
      await wallet.save();
      order.walletAmount = 0;
    }

    const amountToPay = order.finalAmount;

    const receipt = `rcpt_${uuidv4().replace(/-/g, "").slice(0, 32)}`;
    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: Math.round(amountToPay * 100),
        currency: "INR",
        receipt,
      });
    } catch (razorpayError) {
      console.error("Razorpay retry error:", razorpayError);
      return res.status(400).json({
        error: `Failed to create Razorpay order: ${razorpayError.error?.description || "Unknown error"
          }`,
      });
    }

    order.razorpayOrderId = razorpayOrder.id;
    order.paymentStatus = "Pending";
    await order.save();

    res.json({
      orderId: order.orderId,
      razorpayOrderId: razorpayOrder.id,
      amount: amountToPay * 100,
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


const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.session.user._id;

    const order = await Order.findOne({ orderId, user: userId });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.paymentStatus !== "Failed" && order.paymentStatus !== "Pending") {
      return res.status(400).json({ error: "Order cannot be cancelled at this stage" });
    }

    if (order.walletAmount > 0) {
      let wallet = await Wallet.findOne({ user: userId });
      if (!wallet) {
        wallet = new Wallet({
          user: userId,
          balance: order.walletAmount,
          transactions: [{
            type: "credit",
            amount: order.walletAmount,
            description: `Refund for cancelled order ${order.orderId}`,
            date: new Date(),
          }],
        });
      } else {
        wallet.balance += order.walletAmount;
        wallet.transactions.push({
          type: "credit",
          amount: order.walletAmount,
          description: `Refund for cancelled order ${order.orderId}`,
          date: new Date(),
        });
      }
      await wallet.save().catch(walletErr => {
        console.error("Wallet save error:", walletErr);
        throw new Error("Failed to update wallet balance");
      });
    }

    order.status = "Cancelled";
    order.paymentStatus = "Cancelled";
    order.cancelReason = "Cancelled by user due to payment failure";
    await order.save().catch(orderErr => {
      console.error("Order save error:", orderErr);
      throw new Error("Failed to update order status");
    });

    const cart = await Cart.findOne({ userId });
    if (cart && cart.coupon?.couponId && order.couponApplied) {
      const coupon = await Coupon.findById(order.couponId);
      if (coupon && coupon.userId.includes(userId)) {
        coupon.userId = coupon.userId.filter(id => id.toString() !== userId.toString());
        await coupon.save().catch(couponErr => {
          console.error("Coupon save error:", couponErr);
          throw new Error("Failed to update coupon");
        });
      }
      cart.coupon = { couponId: null, discount: 0, couponName: "" };
      await cart.save().catch(cartErr => {
        console.error("Cart save error:", cartErr);
        throw new Error("Failed to update cart");
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ error: error.message || "Error cancelling order" });
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
  cancelOrder
};