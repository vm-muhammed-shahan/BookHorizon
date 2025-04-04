const mongoose = require("mongoose");
const {Schema} = mongoose;

const autherSchema = new Schema({

  AutherName:{
    type: String,
    required: true
  },
  AutherImage:{
    type:[String],
    required: true
  },
  isBlocked:{
    type: Boolean,
    default: false
  },
  createdAt:{
    type: Date,
    default: Date.now
  }
})

const Auther = mongoose.model("Auther", autherSchema);
module.exports = Auther;