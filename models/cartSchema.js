const mongoose = require('mongoose');
const { Schema } = mongoose;

const cartSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    },
    totalPrice: {
      type: Number,
      required: true
    }
  }],
  coupon: {
    couponId: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon',
      default: null
    },
    discount: {
      type: Number,
      default: 0
    },
    couponName: {
      type: String,
      default: ''
    }
  }
});

module.exports = mongoose.model('Cart', cartSchema);
