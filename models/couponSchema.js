
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const couponSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  discountPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  minimumPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  createdOn: {
    type: Date,
    default: Date.now,
  },
  expireOn: {
    type: Date,
    required: true,
  },
  islist: {
    type: Boolean,
    default: true,
  },
  userId: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
});


couponSchema.pre('save', function(next) {
  const maxDiscount = (this.minimumPrice * this.discountPercentage) / 100;
  if (this.minimumPrice <= maxDiscount) {
    return next(new Error('Minimum purchase amount must be greater than the potential discount value'));
  }
  next();
});


module.exports = mongoose.model("Coupon", couponSchema);