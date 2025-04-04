const mongoose = require("mongoose");

const {Schema} = mongoose;

const couponSchema = new mongoose.Schema({
name: {
  type: String,
  required: true,
  unique: true, 
},
createdOn :{
  type: Date,
  default: Date.now,
  required: true,
},

expaireOn :{
  type: Date,
  required: true,
},
offerPrice:{
  type: Number,
  required: true,
},
minimumPrice:{
 type:Number,
 required: true
},

islist:{
  type:Boolean,
  default:true
},
userId:[{
  type:mongooseSchema.Types.ObjectId,
  ref:"User",
  required:true,
}]


})
const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;