const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema")
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const crypto = require('crypto');
const env = require("dotenv").config();
const session = require("express-session");
const { resendOtp } = require("./userController");
// const user = require("../../models/userSchema");

//////////////////////////////////////////////////////////////////////////////////
// function generateOtp() {
//   const digits = "123456789";
//   let otp = "";
//   for (let i = 0; i < 6; i++) {
//     otp += digits[Math.floor(Math.random() * digits.length)];
//   }
//   return otp;
// }



// const sendVerificationEmail = async (email, otp) => {
//   try {
//     const transporter = nodemailer.createTransport({
//       service: "gmail",
//       port: 587,
//       secure: false,
//       requireTLS: true,
//       auth: {
//         user: process.env.NODEMAILER_EMAIL,
//         pass: process.env.NODEMAILER_PASSWORD,

//       }

//     })




//     const mailOptions = {
//       from: process.env.NODEMAILER_EMAIL,
//       to: email,
//       subject: "Your OTP for password reset",
//       text: `Your OTP is ${otp}`,
//       html: `<b><h4>Your OTP: ${otp}</h4><br></b>`
//     }

//     const info = await transporter.sendMail(mailOptions);
//     console.log("Email sent:", info.messageId);
//     return true;

//   } catch (error) {

//     console.error("Error sending email", error);
//     return false;

//   }
// }



// const securePassword = async (password) => {
//   try {
//     const passwordHash = await bcrypt.hash(password, 10);
//     return passwordHash;

//   } catch (error) {

//   }
// }

// const getForgotPassPage = async (req, res) => {
//   try {
//     const user = req.session.user
//     return res.render("forgot-password", { user });
//   } catch (error) {
//     res.redirect("/pageNotFound");
//   }
// }


// const forgotEmailValid = async (req, res) => {
//   try {
//     const { email } = req.body;
//     const findUser = await User.findOne({ email: email });
//     if (findUser) {
//       const otp = generateOtp();
//       const emailSent = await sendVerificationEmail(email, otp);
//       if (emailSent) {
//         req.session.userOtp = otp;
//         req.session.email = email;
//         console.log("OTP:", otp);
//         res.render("forgotPass-otp", { user: findUser });


//       } else {
//         res.json({ success: false, message: "Failed to send OTP, Please try again" });
//       }
//     } else {
//       res.render("forgot-password", {
//         message: "User with this email does not exist"
//       });
//     }
//   } catch (error) {
//     res.redirect("/pageNotFound");
//   }
// }

// const verifyForgotPassOtp = async (req, res) => {
//   try {

//     const enteredOtp = req.body.otp;
//     console.log("Entered OTP:", enteredOtp);
//     console.log("Session OTP:", req.session.userOtp);
//     if (enteredOtp == req.session.userOtp) {
//       res.status(200).json({ success: true, redirectUrl: "/reset-password" });
//     } else {
//       res.json({ success: false, message: "OTP not matching" });
//     }

//   } catch (error) {
//     res.status(500).json({ success: false, message: "An error occured. please try again" });
//   }
// }

// const getResetPassPage = async (req, res) => {
//   try {
//     res.render("reset-password", { user: req.session.user });

//   } catch (error) {
//     res.redirect("/pageNotFound");

//   }
// }

// const resendOTP = async (req, res) => {
//   try {

//     const otp = generateOtp()
//     req.session.userOtp = otp;
//     const email = req.session.email;
//     console.log("Resending OTP to email:", email);
//     const emailSent = await sendVerificationEmail(email, otp);
//     if (emailSent) {
//       console.log("Resend OTP:", otp);
//       res.status(200).json({ success: true, message: "Resend OTP Successful" });
//     }


//   } catch (error) {

//     console.error("Error in resend otp", error);
//     res.status(500).json({ success: false, message: 'Internal Server Error' });

//   }
// }


// const postNewPassword = async (req, res) => {
//   try {
//     const { newPass1, newPass2 } = req.body;
//     const email = req.session.email;
//     if (newPass1 === newPass2) {
//       const passwordHash = await securePassword(newPass1);
//       await User.updateOne(
//         { email: email },
//         { $set: { password: passwordHash } }
//       )
//       res.redirect("/login");
//     } else {
//       res.render("reset-password", { message: 'passwords do not match' });
//     }
//   } catch (error) {
//     res.redirect("/pageNotFound");
//   }
// }


// const loadUserProfile = async (req, res) => {
//   try {
//     const userId = req.session.user?._id;
//     if (!userId) {
//       return res.redirect('/login');
//     }
//     const user = await User.findById(userId)
//       .select('name email phone profileImage')
//       .lean();
//     if (!user) {
//       return res.status(404).send("User not found");
//     }
//     const addressData = await Address.findOne({ userId }).lean();
//     res.render('profile', {
//       user,
//       addresses: addressData?.address || [],
//     });
//   } catch (error) {
//     console.log("Error loading user profile:", error);
//     res.status(500).send("Internal Server Error");
//   }
// };



// const userProfile = async (req, res) => {
//   try {
//     const userId = req.session.user;
//     const userData = await User.findById(userId);
//     const addressData = await Address.findOne({userId: userId});
//     res.render("profile", {user: userData,userAddress: addressData});
//   } catch (error) {
//     console.error("Error loading user profile:", error);
//     res.redirect("/pageNotFound");
//   }
// }




// const changeEmail = async (req, res) => {
//   try {
//     const userId = req.session.user?._id;
//     if (!userId) {
//       return res.redirect('/login');
//     }
//     const user = await User.findById(userId)
//       .select('name email phone profileImage')
//       .lean();
//     if (!user) {
//       return res.status(404).send("User not found");
//     }
//     res.render('change-email', { user });
//   } catch (error) {
//     console.log("Error loading change email page:", error);
//     res.status(500).send("Internal Server Error");
//   }
// }





// const changeEmailValid = async (req, res) => {
//   try {
//     const { email } = req.body;
//     const userExists = await User.findOne({ email });
//     if (userExists) {
//       const otp = generateOtp();
//       const emailSent = await sendVerificationEmail(email, otp);
//       if (emailSent) {
//         req.session.userOtp = otp;
//         req.session.userData = req.body;
//         req.session.email = email;
//         res.render("change-email-otp", { user: req.session.user });
//         console.log("Email Send:", email);
//         console.log("OTP:", otp);
//       } else {
//         res.json("email-error");
//       }
//     } else {
//       res.render("change-email", {
//         message: "User with this email does not exist"
//       });
//     }
//   } catch (error) {
//     res.redirect("/pageNotFound");
//   }
// }


// const verifyEmailOtp = async (req, res) => {
//   try {
//     const enteredOtp = req.body.otp;
//     if (enteredOtp == req.session.userOtp){
//     req.session.userData = req.body.userData;
//     res.render("new-email", { 
//      userData: req.session.userData,
//       user: req.session.user,
      
//     });
//     }else{
//       res.render("change-email-otp", {
//         message: "OTP not matching",
//         userData: req.session.userData,
//       })
//     }
//   } catch (error) {
//     res.redirect("/pageNotFound");
//   }
// }


// const updateEmail = async (req, res) => {
//   try {
//     const newEmail = req.body.newEmail;
//     const userId = req.session.user
//     await User.findByIdAndUpdate(userId, { email: newEmail });
//     res.redirect("/profile");
//   } catch (error) {
//     res.redirect("/pageNotFound");
//   }
// }


// const changePassword = async (req, res) => {
//   try {
//     res.render("change-password", { user: req.session.user });
//   } catch (error) {
//     res.redirect("/pageNotFound");
//   }
// }



// const changePasswordValid = async (req, res) => {
//   try {
//     const {email} = req.body;
//     const userExists = await User.findOne({ email});
//     if(userExists){
//       const otp = generateOtp();
//       const emailSent = await sendVerificationEmail(email, otp);
//       if(emailSent){
//         req.session.userOtp = otp;
//         req.session.userData = req.body;
//         req.session.email = email;
//         res.render("change-password-otp", { user: req.session.user });
//         console.log("OTP", otp);
//       }else{
//         res.json({
//           success: false,
//           message: "Failed to send OTP, Please try again",
//         });
//       }
//     }else{
//       res.render("change-password", {
//         message: "User with this email does not exist",
//       })
//     }   
//   } catch (error) {
//     console.log("Error in change password validation", error);
//     res.redirect("/pageNotFound");
//   }
// }


// const verifyChangePassOtp = async (req, res) => {
//   try {
//     const enteredOtp = req.body.otp;
//     if (enteredOtp == req.session.userOtp) {
//       res.json({success: true, redirectUrl: "/reset-password"});
//     }else{
//       res.json({success: false, message: "OTP not matching"});
//     }
//   } catch (error) {
//     res.status(500).json({success: false, message: "An error occured. please try again later"});
//   }
// }


// const addAddress = async (req, res) => {
//   try {
//     const user = req.session.user;
//     res.render("add-address", {user : user});
//   } catch (error) {
//     res.redirect("/pageNotFound");
//   }
// }


// const postAddAddress = async (req, res) => {
//   try {
//     const userId = req.session.user;
//     const userData = await User.findOne({ _id: userId });
//     const {addressType, name, city, landMark, state, pincode, phone,altPhone} = req.body;

//     const userAddress = await Address.findOne({ userId: userData._id });
//     if(!userAddress){
//       const newAddress = new Address({
//         userId: userData._id,
//         address: [{
//           addressType,
//           name,
//           city,
//           landMark,
//           state,
//           pincode,
//           phone,
//           altPhone
//         }]
//       })
//       await newAddress.save();
//     }else{
//       userAddress.address.push({addressType, name, city, landMark, state, pincode, phone, altPhone});
//       await userAddress.save();
//     }
//       res.redirect("/profile");
//   } catch (error) {
    
//     console.error("Error in adding address", error);

//     res.redirect("/pageNotFound");
//   }
// }

/////////////////////////////////////////////////////////////////////////////////////////////////


















// Show user profile
const  getProfilePage = async (req, res) => {
  try {
   
    const userId = req.session.userId;
    if (!userId) {
      return res.redirect('/login');
    }

    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    
    const addressDoc = await Address.findOne({ userId });
    const addresses = addressDoc ? addressDoc.address : [];

    
    const orders = await Order.find({ _id: { $in: user.orderHistory } })
      .populate('orderedItems.product')
      .sort({ createdOn: -1 });


    res.render('user/profile', {
      user,
      addresses,
      orders,
      memberSince: user.createdOn.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};




const getEditProfile = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    res.render('edit-profile', { user });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
};


// Handle edit profile 
const postEditProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.session.user._id);

    user.name = name;
    user.phone = phone;
    await user.save();
   req.session.userId = user._id; 

    
    res.redirect('/profile');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
};



// // Verify OTP for email change
// const postVerifyOtp = async (req, res) => {
//   try {
//     const { otp } = req.body;
//     if (!req.session.otp || req.session.otp.code !== otp || Date.now() > req.session.otp.expires) {
//       return res.render('verify-otp', { email: req.session.otp.email, error: 'Invalid or expired OTP' });
//     }
//     const user = await User.findById(req.session.userId);
//     const { name, email, phone, profileImage } = req.session.pendingProfileUpdate;
//     user.name = name;
//     user.email = email;
//     user.phone = phone;
//     if (profileImage) user.profileImage = profileImage;
//     await user.save();
//     delete req.session.otp;
//     delete req.session.pendingProfileUpdate;
//     res.redirect('/profile');
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Server error');
//   }
// };


// Show change password page
// const getChangePassword = async (req, res) => {
//   try {
//     const user = await User.findById(req.session.user._id);
//     res.render('change-password', { user, error: null });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Server error');
//   }
// };


// // Handle change password
// const postChangePassword = async (req, res) => {
//   try {
//     const { currentPassword, newPassword, confirmPassword } = req.body;
//     const user = await User.findById(req.session.user._id);

//     // Verify current password
//     if (!user.password || !(await bcrypt.compare(currentPassword, user.password))) {
//       return res.render('change-password', { error: 'Incorrect current password' });
//     }

//     // Validate new password
//     if (newPassword !== confirmPassword) {
//       return res.render('change-password', { error: 'Passwords do not match' });
//     }

//     // Update password
//     user.password = await bcrypt.hash(newPassword, 10);
//     await user.save();
//     res.redirect('/profile');
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Server error');
//   }
// };



// // Show forgot password page
// const getForgotPassword = (req, res) => {
//   res.render('forgot-password');
// };



// // Handle forgot password (send reset link)
// const postForgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.render('forgot-password', { error: 'Email not found' });
//     }

//     // Generate reset token
//     const token = crypto.randomBytes(20).toString('hex');
//     user.resetPasswordToken = token;
//     user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
//     await user.save();

//     // Send reset email
//     await transporter.sendMail({
//       from: process.env.NODEMAILER_EMAIL,
//       to: email,
//       subject: 'Password Reset Request',
//       text: `Click this link to reset your password: http://localhost:3000/reset-password/${token}`
//     });

//     res.render('forgot-password', { message: 'Reset link sent to your email' });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Server error');
//   }
// };


// // Show reset password page
// const getResetPassword = async (req, res) => {
//   try {
//     const user = await User.findOne({
//       resetPasswordToken: req.params.token,
//       resetPasswordExpires: { $gt: Date.now() }
//     });
//     if (!user) {
//       return res.render('forgot-password', { error: 'Invalid or expired token' });
//     }
//     res.render('reset-password', { token: req.params.token });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Server error');
//   }
// };


// // Handle reset password
// const postResetPassword = async (req, res) => {
//   try {
//     const { password, confirmPassword } = req.body;
//     const user = await User.findOne({
//       resetPasswordToken: req.params.token,
//       resetPasswordExpires: { $gt: Date.now() }
//     });

//     if (!user) {
//       return res.render('forgot-password', { error: 'Invalid or expired token' });
//     }

//     if (password !== confirmPassword) {
//       return res.render('reset-password', { token: req.params.token, error: 'Passwords do not match' });
//     }

//     user.password = await bcrypt.hash(password, 10);
//     user.resetPasswordToken = undefined;
//     user.resetPasswordExpires = undefined;
//     await user.save();
//     res.redirect('/login');
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Server error');
//   }
// };



// // Address Management
// // Add new address
// const postAddAddress = async (req, res) => {
//   try {
//     const { addressType, name, city, landMark, state, pincode, phone, altPhone, isDefault } = req.body;
//     let addressDoc = await Address.findOne({ userId: req.session.userId });

//     const newAddress = {
//       addressType,
//       name,
//       city,
//       landMark,
//       state,
//       pincode,
//       phone,
//       altPhone,
//       isDefault: isDefault === 'on'
//     };

//     if (!addressDoc) {
//       addressDoc = new Address({ userId: req.session.userId, address: [newAddress] });
//     } else {
//       if (isDefault === 'on') {
//         addressDoc.address.forEach(addr => (addr.isDefault = false));
//       }
//       addressDoc.address.push(newAddress);
//     }

//     await addressDoc.save();
//     res.redirect('/profile');
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Server error');
//   }
// };




// // Show edit address page
// const getEditAddress = async (req, res) => {
//   try {
//     const addressDoc = await Address.findOne({ userId: req.session.userId });
//     const address = addressDoc.address.id(req.params.addressId);
//     if (!address) {
//       return res.redirect('/profile');
//     }
//     res.render('edit-address', { address });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Server error');
//   }
// };



// // Update address
// const postEditAddress = async (req, res) => {
//   try {
//     const { addressType, name, city, landMark, state, pincode, phone, altPhone, isDefault } = req.body;
//     const addressDoc = await Address.findOne({ userId: req.session.user._id });
//     const address = addressDoc.address.id(req.params.addressId);

//     if (!address) {
//       return res.redirect('/profile');
//     }

//     address.addressType = addressType;
//     address.name = name;
//     address.city = city;
//     address.landMark = landMark;
//     address.state = state;
//     address.pincode = pincode;
//     address.phone = phone;
//     address.altPhone = altPhone;
//     address.isDefault = isDefault === 'on';

//     if (isDefault === 'on') {
//       addressDoc.address.forEach(addr => {
//         if (addr._id.toString() !== req.params.addressId) addr.isDefault = false;
//       });
//     }

//     await addressDoc.save();
//     res.redirect('/profile');
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Server error');
//   }
// };



// // Delete address
// const deleteAddress = async (req, res) => {
//  try {
//     const addressDoc = await Address.findOne({ userId: req.session.user._id });
//     if (!addressDoc) {
//       return res.redirect('/profile');
//     }

//     // Check if the address exists
//     const addressExists = addressDoc.address.some(addr => addr._id.toString() === req.params.addressId);
//     if (!addressExists) {
//       return res.redirect('/profile');
//     }

//     // Remove the address subdocument by its _id
//     addressDoc.address.pull({ _id: req.params.addressId });
//     await addressDoc.save();
//     res.redirect('/profile');
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Server error');
//   }
// };


module.exports = {
  


getProfilePage,
// getEditProfile,
// postEditProfile,
// postVerifyOtp,
// getChangePassword ,
// postChangePassword,
// getForgotPassword,
// postForgotPassword,
// getResetPassword,
// postResetPassword ,
// postAddAddress,
// getEditAddress,
// postEditAddress,
// deleteAddress,
}