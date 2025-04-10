const  mongoose = require('mongoose');
const {Schema} = mongoose;


const userSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required:true
                        
  },
  googleId:{
    type: String,
    default:null
    
  },
phone :{
  type: String,
  required:false,
  unique:true,
  sparse:true,
  default:null,
},

password:{
type:String,
required:false,
},
isBlocked:{
  type: Boolean,
  default:false
},
isAdmin:{
  type:Boolean,
  default:false
},
cart:[{
  type: Schema.Types.ObjectId,
  ref: "Cart"
}],
wallet:[{
  type:Schema.Types.ObjectId,
  ref:"wishlist"
}],
orderHistory:[{
  type:Schema.Types.ObjectId,
  ref:"order"
}],
createdOn :{
  type:Date,
  default:Date.now
},
referalcode:{
  type:String,
  // required: true
},
redeemed:{
  type:Boolean,
  //default : false
},
redeemedUsers:[{
  type:Schema.Types.ObjectId,
  ref:"user",
  // required:true
}],
searchHistory:[{
  category:{
    type:Schema.Types.ObjectId,
    ref:"category"
  },
  brand: {
    type:String,
  },
  searchon: {
    type: Date,
    default:Date.now
  }
}]
})

const user = mongoose.model("User",userSchema);

module.exports = user;