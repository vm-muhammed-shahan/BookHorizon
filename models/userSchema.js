const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const userSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true                    
  },
  googleId: {
    type: String,
    unique: true
  },
  phone: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    default: null,
  },
  password: {
    type: String,
    required: false,
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  cart: [{
    type: Schema.Types.ObjectId,
    ref: "Cart"
  }],
  wallet: [{
    type: Schema.Types.ObjectId,
    ref: "wishlist"
  }],
  orderHistory: [{
    type: Schema.Types.ObjectId,
    ref: "order"
  }],
  createdOn: {
    type: Date,
    default: Date.now
  },
  referralCode: {
    type: String,
    unique: true,
    default: () => uuidv4().split("-")[0], // Generate a unique referral code
  },
  redeemed: {
    type: Boolean,
    default: false
  },
  redeemedUsers: [{
    type: Schema.Types.ObjectId,
    ref: "User",
  }],
  searchHistory: [{
    category: {
      type: Schema.Types.ObjectId,
      ref: "category"
    },
    brand: {
      type: String,
    },
    searchon: {
      type: Date,
      default: Date.now
    }
  }],
  profileImage: {
    type: String,
    default: null
  },
});

const User = mongoose.model("User", userSchema);
module.exports = User;