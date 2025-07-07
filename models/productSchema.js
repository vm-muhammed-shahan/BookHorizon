const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema({
  productName: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  regularPrice: {
    type: Number,
    required: true,
  },
  salePrice: {
    type: Number,
    required:false,
  },
  quantity: {
    type: Number,
    default: 0,
  },
  productImage: {
    type: [String],
    required: true,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ["Available", "Out of Stock", "Discontinued"],
    required: true,
    default: "Available",
  },
  productOffer: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
}, {
  timestamps: true
});

productSchema.pre("save", function (next) {
  if (this.quantity === 0) {
    this.status = "Out of Stock";
  } else if (this.status === "Out of Stock" && this.quantity > 0) {
    this.status = "Available";
  }
  next();
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;