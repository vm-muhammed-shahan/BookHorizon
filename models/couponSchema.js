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
    min: [1, "Discount must be at least 1%"],
    max: [99, "Discount cannot exceed 99%"],
  },
  minimumPrice: {
    type: Number,
    required: true,
    min: [1, "Minimum purchase amount must be at least 1"],
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const expDate = new Date(value);
  expDate.setHours(0, 0, 0, 0);
  return expDate >= tomorrow;
},
message: "Expiry date must be in the future (not today)",
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
