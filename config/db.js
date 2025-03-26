// const mongoose = require("mongoose");
// const env = require("dotenv").config();

// const connectDB = async ()=>{
//   try{

//  await mongoose.connect(process.env.MONGODB_URI);
// console.log("DB Connected");
//   } catch (error){

// console.log("DB Connection error",error.message);
// process.exit(1);

//   }
// }

// module.exports = connectDB;

// const mongoose = require("mongoose");
// require("dotenv").config(); // Simplified dotenv loading

// const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGODB_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true
//     });
//     console.log("DB Connected Successfully");
//   } catch (error) {
//     console.error("DB Connection error:", error.message);
//     process.exit(1);
//   }
// };

// module.exports = connectDB;

const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    // Explicitly specify localhost IPv4 instead of IPv6
    const mongoURI = process.env.MONGODB_URI.replace('::1', '127.0.0.1');
    
    console.log('Attempting to connect to:', mongoURI);
    
    await mongoose.connect(mongoURI, {
      // Remove deprecated options
      serverSelectionTimeoutMS: 5000, // 5 second timeout
    });
    
    console.log("DB Connected Successfully");
  } catch (error) {
    console.error("Detailed DB Connection Error:", {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    process.exit(1);
  }
};

module.exports = connectDB;