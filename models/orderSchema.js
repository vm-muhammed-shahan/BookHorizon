const mongoose = require("mongoose");
const { Schema } = mongoose;


const counterSchema = new Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 100000 }, 
});

const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);


const orderSchema = new Schema({
  orderId: {
    type: String,
    unique: true,
  },
  orderedItems: [
    {
      product: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        default: 0,
      },
      cancelled: {
        type: Boolean,
        default: false,
      },
      cancelReason: {
        type: String,
        default: "",
      },
      returned: {
        type: Boolean,
        default: false,
      },
      returnReason: {
        type: String,
        default: "",
      },
      returnStatus: {
        type: String,
        enum: ["pending", "approved", "rejected", null],
        default: null,
      },
    },
  ],
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  couponDiscount: {
    type: Number,
    default: 0,
  },
  tax: {
    type: Number,
    default: 0,
  },
  finalAmount: {
    type: Number,
    required: true,
  },
  walletAmount: {
    type: Number,
    default: 0,
  },
  address: {
    type: {
      addressType: { type: String, required: true },
      name: { type: String, default: "" },
      city: { type: String, required: true },
      landMark: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: Number, required: true },
      phone: { type: String, required: true },
      altPhone: { type: String, default: "" },
      isDefault: { type: Boolean, default: false },
    },
    required: true,
  },
  invoiceDate: {
    type: Date,
  },
  status: {
    type: String,
    required: true,
    enum: [
      "Pending",
      "Processing",
      "Shipped",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
      "Return Request",
      "Returned",
    ],
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true,
  },
  deliveredOn: {
    type: Date,
    default: null,
  },
  couponApplied: {
    type: Boolean,
    default: false,
  },
  couponCode: {
    type: String,
    default: null,
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ["cod", "razorpay", "wallet"],
    default: "cod",
  },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Completed", "Failed", "Cancelled"],
    default: "Pending",
  },
  shippingCharge: {
    type: Number,
    required: true,
    default: 50,
  },
  cancelReason: {
    type: String,
    default: "",
  },
  razorpayOrderId: {
    type: String,
    default: null,
  },
});


orderSchema.pre("save", async function (next) {
  if (this.isNew && !this.orderId) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { name: "orderId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.orderId = `ORD${counter.seq}`;
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;