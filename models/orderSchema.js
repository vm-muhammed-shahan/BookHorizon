const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");


const orderSchema = new Schema({
  orderId: {
    type: String,
    default: () => uuidv4(),
    unique: true
  },
  orderedItems: [{
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true
    },
    price: {
      type: Number,
      default: 0
    },
    cancelled: {
      type: Boolean,
      default: false
    },
    cancelReason: {
      type: String,
      default: ''
    },
    returned: {
      type: Boolean,
      default: false
    },
    returnReason: {
      type: String,
      default: ''
    }
  }],
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  totalPrice: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  address: {
    type: {
      addressType: { type: String, required: true },
      name: { type: String, required: true },
      city: { type: String, required: true },
      landMark: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: Number, required: true },
      phone: { type: String, required: true },
      altPhone: { type: String, required: true },
      isDefault: { type: Boolean, default: false }
    },
    required: true
  },
  invoiceDate: {
    type: Date
  },
  status: {
    type: String,
    required: true,
    enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Return Request", "Returned"]
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true
  },
  couponApplied: {
    type: Boolean,
    default: false
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ["cod", "razorpay"],
    default: "cod"
  },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Completed", "Failed"],
    default: "Pending"
  },
  shippingCharge: {
    type: Number,
    required: true,
    default: 50
  },
  cancelReason: {
    type: String,
    default: ''
  }
});
const Order = mongoose.model("order", orderSchema);
module.exports = Order;

