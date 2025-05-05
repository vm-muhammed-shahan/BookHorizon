const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/user/userController');
const profileController = require("../controllers/user/profileController");
const productController = require("../controllers/user/productController");
const {userAuth} = require('../middlewares/auth');
const user = require('../models/userSchema');





router.use((req, res, next) => {
  // console.log("Session User:", req.session.user);
  next();
  });
 router.get("/pageNotFound",userController.pageNotFound);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.post("/verify-otp",userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback', passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
  req.session.user = req.user; 
  console.log("Google Authenticated User:", req.session.user);
  res.redirect('/');
});

// shop page
router.get("/login",userController.loadLogin);
router.post("/login",userController.login);
router.get("/",userController.loadHomepage);
router.get("/logout",userController.logout);
router.get("/shop",userController.loadShoppingPage);
router.get("/filter", userController.filterProduct);
router.get("/filterPrice", userController.filterByprice);
router.post("/search", userController.searchProducts);
// Profile  Management
router.get("/forgot-password",profileController.getForgotPassPage);
router.post("/forgot-email-valid",profileController.forgotEmailValid);
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp);
router.get("/reset-password",profileController.getResetPassPage);
router.post("/resend-forgot-otp",profileController.resendOtp);
router.post("/reset-password",profileController.postNewPassword);
// products Management //
router.get("/productDetails",productController.productDetails);



module.exports = router;
