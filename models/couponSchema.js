const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const couponSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  discountPercentage: {
    type: Number,
    required: true,
    min: [0, "Discount must be at least 0%"],
    max: [100, "Discount cannot exceed 100%"],
  },
  minimumPrice: {
    type: Number,
    required: true,
    min: [0, "Minimum purchase amount must be at least 0"],
  },
  createdOn: {
    type: Date,
    default: Date.now,
  },
  expireOn: {
    type: Date,
    required: true,
    validate: {
      validator: function (value) {
        return value > Date.now();
      },
      message: "Expiry date must be in the future",
    },
  },
  islist: {
    type: Boolean,
    default: true,
  },

  usageLimit: {
    type: Number,
    default: 1, 
    min: [1, "Usage limit must be at least 1"],
  },
  usedCount: {
    type: Number,
    default: 0, 
  },

  userId: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
});


couponSchema.pre("save", function (next) {
  const maxDiscount = (this.minimumPrice * this.discountPercentage) / 100;
  if (this.minimumPrice <= maxDiscount) {
    return next(
      new Error(
        "Minimum purchase amount must be greater than the potential discount value"
      )
    );
  }
  next();
});


module.exports = mongoose.model("Coupon", couponSchema);
