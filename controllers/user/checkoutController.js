const Cart = require("../../models/cartSchema");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Wallet = require("../../models/walletSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Coupon = require("../../models/couponSchema");
const Offer = require("../../models/offerSchema");
const Razorpay = require("razorpay");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const { applyBestOffer } = require("../../controllers/admin/productController");
const http = require("../../helpers/const");
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


const checkoutPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: { path: "category" }
    });

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    const validItems = [];
    const removedItems = [];
    let stockAdjusted = false;

    const offers = await Offer.find({
      offerType: { $in: ["product", "category"] },
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });

    for (const item of cart.items) {
      const product = item.productId;
      if (
        item.productId &&
        !item.productId.isBlocked &&
        item.productId.status === "Available" &&
        item.productId.quantity > 0 &&
        item.quantity > 0 &&
        item.productId.category?.isListed !== false
      ) {

        const { discountedPrice } = await applyBestOffer(product, offers);

        item.price = discountedPrice;
        item.totalPrice = item.quantity * discountedPrice;

        if (item.quantity > product.quantity) {
          item.quantity = product.quantity;
          item.totalPrice = item.quantity * discountedPrice;
          stockAdjusted = true;
        }

        validItems.push(item);
      } else {
        removedItems.push(item.productId?.productName || "Unknown item");
      }
    }

    await cart.save();


    if (validItems.length === 0) {
      const userData = await User.findOne({ _id: userId });
      return res.render("cart", {
        user: userData,
        items: [],
        hasValidItems: false,
        sweetAlertMessage: "Sorry, all the products in your cart are currently unavailable",
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

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const availableCoupons = await Coupon.find({
      islist: true,
      expireOn: { $gte: currentDate },
      userId: { $not: { $elemMatch: { $eq: userId } } },
      minimumPrice: { $lte: subTotal },
    });

    // 🔹 NEW LOGIC STARTS: Coupon revalidation   if not working remove it
    let discount = 0;
    let couponApplied = cart.coupon?.couponId ? true : false;
    let couponName = cart.coupon?.couponName || "";
    let removedCouponMessage = null;

    if (couponApplied) {
      const coupon = await Coupon.findById(cart.coupon.couponId);
      if (coupon) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const expDate = new Date(coupon.expireOn);
        expDate.setHours(0, 0, 0, 0);

        if (expDate < now || subTotal < coupon.minimumPrice) {
          // Coupon expired or subtotal below min — remove it
          cart.coupon = { couponId: null, discount: 0, couponName: "" };
          await cart.save();
          couponApplied = false;
          couponName = "";
          removedCouponMessage = `Coupon "${coupon.name}" was removed as your cart no longer meets the minimum purchase requirement (₹${coupon.minimumPrice.toFixed(2)}).`;
        } else {
          // Coupon still valid — recalc discount
          const preTaxTotal = subTotal;
          const tax = preTaxTotal * 0.05;
          const shipping = 50;
          const totalBeforeDiscount = preTaxTotal + tax + shipping;
          discount = (totalBeforeDiscount * coupon.discountPercentage) / 100;
          if (discount > totalBeforeDiscount) discount = totalBeforeDiscount;
        }
      } else {
        // Coupon not found in DB — remove
        cart.coupon = { couponId: null, discount: 0, couponName: "" };
        await cart.save();
        couponApplied = false;
        couponName = "";
        removedCouponMessage = "Applied coupon was invalid and has been removed.";
      }
    }
    //  end here remove it



    const shipping = 50;
    const tax = subTotal * 0.05;
    const totalBeforeDiscount = subTotal + tax + shipping;
    const finalAmount = totalBeforeDiscount - discount;

    const isWalletPaymentEnabled = wallet.balance >= finalAmount;

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
      stockAdjusted,
      removedItems,
      removedCouponMessage, 
    });
  } catch (error) {
    console.error("Checkout page error:", error);
    res.status(http.Internal_Server_Error).render("error", { message: "Error loading checkout page" });
  }
};


const applyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;
    const userId = req.session.user._id;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(http.Bad_Request).json({ error: "Cart is empty" });
    }

    const validItems = cart.items.filter(
      (item) =>
        item.productId &&
        !item.productId.isBlocked &&
        item.productId.status === "Available" &&
        item.productId.quantity >= item.quantity
    );

    if (validItems.length === 0) {
      return res.status(http.Bad_Request).json({ error: "No valid items in cart" });
    }

    const subTotal = validItems.reduce((acc, item) => acc + item.totalPrice, 0);
    const coupon = await Coupon.findOne({ name: couponCode, islist: true });

    if (!coupon) {
      return res.status(http.Bad_Request).json({ error: "Invalid coupon code" });
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const expDate = new Date(coupon.expireOn);
    expDate.setHours(0, 0, 0, 0);

    if (expDate < now) {
      return res.status(http.Bad_Request).json({ error: "Coupon has expired" });
    }


    if (subTotal < coupon.minimumPrice) {
      return res.status(http.Bad_Request).json({ error: `Minimum purchase of ₹${coupon.minimumPrice.toFixed(2)} required` });
    }

    if (coupon.userId.includes(userId)) {
      return res.status(http.Bad_Request).json({ error: "Coupon already used by you" });
    }

    const preTaxTotal = subTotal;
    const tax = preTaxTotal * 0.05;
    const shipping = 50;
    const totalBeforeDiscount = preTaxTotal + tax + shipping;
    const discount = (totalBeforeDiscount * coupon.discountPercentage) / 100;
    if (discount >= totalBeforeDiscount) {
      return res.status(http.Bad_Request).json({ error: "Discount cannot exceed or equal the cart total" });
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
    res.status(http.Internal_Server_Error).json({ error: "Server error while applying coupon" });
  }
};


const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.user._id;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(http.Bad_Request).json({ error: "Cart is empty" });
    }

    if (!cart.coupon?.couponId) {
      return res.status(http.Bad_Request).json({ error: "No coupon applied" });
    }

    const validItems = cart.items.filter(
      (item) =>
        item.productId &&
        !item.productId.isBlocked &&
        item.productId.status === "Available" &&
        item.productId.quantity >= item.quantity
    );

    if (validItems.length === 0) {
      return res.status(http.Bad_Request).json({ error: "No valid items in cart" });
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
    res.status(http.Internal_Server_Error).json({ error: "Server error while removing coupon" });
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
      return res.status(http.Bad_Request).json({ error: "Your cart is empty" });
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
      return res.status(http.Bad_Request).json({
        error: "No valid items in your cart. Please check product availability.",
      });
    }

    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc || !addressDoc.address[selectedAddressIndex]) {
      return res.status(http.Bad_Request).json({ error: "Invalid or missing address" });
    }

    const selectedAddress = addressDoc.address[selectedAddressIndex];
    const subTotal = validItems.reduce((sum, item) => sum + item.totalPrice, 0);

    if (paymentMethod === "cod" && subTotal > 1000) {
      return res.status(http.Bad_Request).json({
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
          // description: `Payment for order ${uuidv4()}`
          description: "Payment for order (ID will be linked after creation)",
          date: new Date(),
        });
        await wallet.save();
      } else {
        return res.status(http.Bad_Request).json({
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
        return res.status(http.Bad_Request).json({
          error: `Failed to create Razorpay order: ${razorpayError.error?.description || "Unknown error"
            }`,
        });
      }
    }

    if (effectivePaymentMethod === "cod" || effectivePaymentMethod === "wallet") {
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
        paymentStatus: effectivePaymentMethod === "cod" ? "Pending" : "Completed",
        shippingCharge: shipping,
      });
      await order.save();

      if (effectivePaymentMethod === "wallet") {
        wallet.transactions = wallet.transactions.map(txn => {
          if (txn.description === "Payment for order (ID will be linked after creation)") {
            txn.description = `Payment for order ${order.orderId}`;
          }
          return txn;
        });
        await wallet.save();
      }


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

      return res.json({ success: true, redirect: `/order/success/${order.orderId}` });
    } else if (paymentMethod === "razorpay") {
      const orderedItems = validItems.map((item) => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.price,
      }));

      const order = new Order({
        orderedItems,
        totalPrice: subTotal,
        discount,
        finalAmount,
        walletAmount: walletAmountUsed,  // 0 for razorpay
        user: userId,
        address: selectedAddress,
        invoiceDate: new Date(),
        couponApplied: cart.coupon?.couponId ? true : false,
        couponId: cart.coupon?.couponId || null,
        status: "Pending",
        paymentMethod: "razorpay",
        paymentStatus: "Pending",
        shippingCharge: shipping,
        razorpayOrderId: razorpayOrder.id,
      });

      await order.save();  // Generates orderId via pre-save hook

      return res.json({
        razorpayOrderId: razorpayOrder.id,
        amount: finalAmount * 100,
        currency: "INR",
        orderId: order.orderId,  // Add this for frontend failure redirect
        key: process.env.RAZORPAY_KEY_ID,
      });
    }
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(http.Internal_Server_Error).json({ error: "Error creating order" });
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
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature === razorpay_signature) {
      const { orderId, razorpay_order_id } = req.body;

      const order = await Order.findOne({ orderId });
      if (!order || order.razorpayOrderId !== razorpay_order_id) {
        return res.json({ success: false, redirect: `/order/failure/unknown` });
      }


      order.paymentStatus = "Completed";

      await order.save();


      if (order.couponApplied && order.couponId) {
        const coupon = await Coupon.findById(order.couponId);
        if (coupon && !coupon.userId.includes(order.user)) {
          coupon.userId.push(order.user);
          await coupon.save();
        }
      }


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

      return res.json({ success: true, redirect: `/order/success/${order.orderId}` });
    } else {
      return res.json({ success: false, redirect: `/order/failure/unknown` });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(http.Internal_Server_Error).json({ error: "Server error during payment verification" });
  }
};



const retryPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.session.user._id;

    const order = await Order.findOne({ orderId, user: userId });
    if (!order) {
      return res.status(http.Not_Found).json({ error: "Order not found" });
    }

    if (order.paymentMethod !== "razorpay") {
      return res.status(http.Bad_Request).json({ error: "Cannot retry payment for this order" });
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
      return res.status(http.Bad_Request).json({
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
    res.status(http.Internal_Server_Error).json({ error: "Error retrying payment" });
  }
};


const paymentFailed = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.session.user._id;

    const order = await Order.findOne({ orderId, user: userId });
    if (!order) {
      return res.status(http.Not_Found).json({ error: "Order not found" });
    }

    if (order.paymentMethod !== "razorpay") {
      return res.status(http.Bad_Request).json({ error: "Invalid payment method for this order" });
    }

    order.paymentStatus = "Failed";
    await order.save();

    res.json({ success: true, redirect: `/order/failure/${order.orderId}` });
  } catch (error) {
    console.error("Error handling payment failure:", error);
    res.status(http.Internal_Server_Error).json({ error: "Error processing payment failure" });
  }
};


const successPage = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderID }).populate({
      path: "orderedItems.product",
      model: "Product",
    });

    if (!order) {
      return res.status(http.Not_Found).send("Order not found");
    }

    res.render("order-success", { order });
  } catch (error) {
    console.error("Error loading success page:", error);
    res.status(http.Internal_Server_Error).send("Failed to load order details");
  }
};


const failurePage = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderID }).populate({
      path: "orderedItems.product",
      model: "Product",
    });

    if (!order) {
      return res.status(http.Not_Found).send("Order not found");
    }

    res.render("order-failure", { order });
  } catch (error) {
    console.error("Error loading failure page:", error);
    res.status(http.Internal_Server_Error).send("Failed to load order details");
  }
};


const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.session.user._id;

    const order = await Order.findOne({ orderId, user: userId });
    if (!order) {
      return res.status(http.Not_Found).json({ error: "Order not found" });
    }

    // Add this check
    if (order.paymentMethod === "razorpay" && order.paymentStatus === "Pending") {
      return res.status(http.Bad_Request).json({ error: "Cannot cancel unverified payment orders" });
    }

    if (order.paymentStatus !== "Failed" && order.paymentStatus !== "Pending") {
      return res.status(http.Bad_Request).json({ error: "Order cannot be cancelled at this stage" });
    }

    if (order.paymentStatus !== "Failed" && order.paymentStatus !== "Pending") {
      return res.status(http.Bad_Request).json({ error: "Cannot cancel non-failed/pending orders here" });
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
    res.status(http.Internal_Server_Error).json({ error: error.message || "Error cancelling order" });
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