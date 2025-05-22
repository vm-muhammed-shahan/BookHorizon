const express = require('express');
const router = express.Router();
const passport = require('passport');
const multer = require('multer');
const userController = require('../controllers/user/userController');
const profileController = require("../controllers/user/profileController");
const productController = require("../controllers/user/productController");
const addressController = require("../controllers/user/addressController");
const cartController = require('../controllers/user/cartController');
const checkoutController = require("../controllers/user/checkoutController");
const orderController = require("../controllers/user/orderController");
const {userAuth} = require('../middlewares/auth');
const user = require('../models/userSchema');


const upload = multer({ dest: 'public/uploads/' });



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
router.get("/search", userController.searchProducts);


// products Management //
router.get("/productDetails",productController.productDetails);





 // profile Managemant
router.get("/profile/edit", userAuth, userController.editProfilePage);
router.get("/profile/edit", userAuth, userController.editProfilePage);
router.get("/profile/edit", userAuth, userController.editProfilePage);
router.get("/profile/edit", userAuth, userController.editProfilePage);
router.get("/profile/edit", userAuth, userController.editProfilePage);
router.post("/reset-password",  userController.postNewPassword)
router.get('/profile', userAuth, userController.getProfile);
router.get("/profile/edit", userAuth, userController.editProfilePage);
router.post("/profile/edit", userAuth, userController.updateProfile);
router.get("/profile/change-password", userAuth, userController.changePassword);
router.post("/change-password", userAuth, userController.changePasswordValid);
router.post("/verify-changepassword-otp", userAuth, userController.verifyChangePassOtp)




router.get("/profile/addresses", userAuth, addressController.getAddresses);
router.post("/profile/addresses/add", userAuth, addressController.addAddress);
router.post("/profile/addresses/edit/:addrId", userAuth, addressController.editAddress);
router.get("/profile/addresses/delete/:addrId", userAuth, addressController.deleteAddress);
router.get("/profile/addresses/set-default/:addrId", userAuth, addressController.setDefaultAddress);


// CartManagement

 router.get("/cart", userAuth, cartController.viewCart);
  router.post("/cart/add", userAuth, cartController.addToCart);
  router.post("/cart/update-quantity", userAuth, cartController.updateQuantity);
  router.get("/cart/remove/:productId", userAuth, cartController.removeItem);


// //checkoutManagement


 router.get("/checkout", userAuth, checkoutController.checkoutPage);
 router.post("/checkout/place-order", userAuth, checkoutController.placeOrder);
 router.get("/order/success/:orderID", userAuth, checkoutController.successPage);



 router.get("/orders", userAuth, orderController.getOrders);
 router.get("/orders/:orderId", userAuth, orderController.getOrderDetail);
 router.post("/orders/cancel", userAuth, orderController.cancelOrder);
 router.post("/orders/return", userAuth, orderController.returnOrder);
 router.get("/orders/invoice/:orderId", userAuth, orderController.downloadInvoice);








module.exports = router;
