const mongoose = require("mongoose");
const { Schema } = mongoose;

const offerSchema = new Schema({
  offerType: {
    type: String,
    enum: ["product", "category", "referral"],
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  discountPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  applicableId: {
    type: Schema.Types.ObjectId,
    refPath: "offerTypeModel",
    required: true,
  },
  offerTypeModel: {
    type: String,
    enum: ["Product", "Category", "User"],
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

offerSchema.pre("save", function (next) {
  const now = new Date();
  if (now < this.startDate || now > this.endDate) {
    this.isActive = false;
  } else {
    this.isActive = true;
  }
  next();
});

module.exports = mongoose.model("Offer", offerSchema);