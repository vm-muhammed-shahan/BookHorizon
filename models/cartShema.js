const mongoose = require("mongoose");
const {schema} = mongoose;

const cartSchema = new Schema({
  userId : {
    type : schema.types.Objectid,
    ref:"User",
    required: true
  },
  items: [{
    productId : {
      type: Schema.types.Objectid,
      ref: "Product",
      required: true
    },
    quantity:{
      type: Number,
      default: 1
    },
    price:{
      type: Number,
      required: true,
    },
    totalPrice:{
      type: Number,
      required:true
    },
        status:{
        type: String,
         default: "Placed"
      },
      cancellationReason:{
        type: String,
        default: "none"
      }

  }]

})

const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;