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
const wishlistController = require("../controllers/user/wishlistController");
const { userAuth } = require('../middlewares/auth');
const user = require('../models/userSchema');
const upload = multer({ dest: 'public/uploads/' });



router.get("/pageNotFound", userController.pageNotFound);
router.get("/signup", userController.loadSignup); 
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), (req, res) => {
  req.session.user = req.user;
  console.log("Google Authenticated User:", req.session.user);
  res.redirect('/');
});

// Referral Link Route
//router.get("/referral/:referralCode", userController.loadSignupWithReferral);

router.get("/login", userController.loadLogin);
router.post("/login", userController.login);
router.get("/", userController.loadHomepage);
router.get("/logout", userController.logout);




// Profile Management
router.get("/change-email", userAuth, userController.changeEmail);
router.post("/change-email", userAuth, userController.changeEmailEmailValid);
router.get('/profile', userAuth, userController.getProfile);
router.get("/profile/edit", userAuth, userController.editProfilePage);
router.post("/profile/edit", userAuth, userController.updateProfile);
router.get("/profile/change-password", userAuth, userController.changePassword);
router.post("/change-password", userAuth, userController.changePasswordValid);
router.post("/verify-changepassword-otp", userAuth, userController.verifyChangePassOtp);



// Shop Page 
router.get("/shop", userController.loadShoppingPage);
router.get("/filter", userController.filterProduct);
router.get("/filterPrice", userController.filterByprice);
router.get("/search", userController.searchProducts);

// Products Management
router.get("/productDetails", userAuth, productController.productDetails);

// Address Management 
router.get("/profile/addresses", userAuth, addressController.getAddresses);
router.post("/profile/addresses/add", userAuth, addressController.addAddress);
router.get("/profile/addresses/edit", userAuth, addressController.getEdit);
router.post("/profile/addresses/edit/:addrId", userAuth, addressController.editAddress);
router.get("/profile/addresses/delete/:addrId", userAuth, addressController.deleteAddress);
router.get("/profile/addresses/set-default/:addrId", userAuth, addressController.setDefaultAddress);

// Wishlist Management
router.get("/wishlist", userAuth, wishlistController.getwishlist);
router.post("/addToWishlist", userAuth, wishlistController.addToWishlist);
router.post('/removeFromWishlist', userAuth, wishlistController.removeFromWishlist);
router.post('/moveToCart', userAuth, wishlistController.moveToCart);
router.post("/clear-wishlist", userAuth, wishlistController.clearWishlist);

// Cart Management
router.get("/cart", userAuth, cartController.viewCart);
router.post("/cart/add", userAuth, cartController.addToCart);
router.post("/cart/update-quantity", userAuth, cartController.updateQuantity);
router.get("/cart/remove/:productId", userAuth, cartController.removeItem);
router.post("/cart/remove", userAuth, cartController.removeItemPost);

// Checkout Management
router.get('/checkout', userAuth, checkoutController.checkoutPage);
router.post('/checkout/apply-coupon', userAuth, checkoutController.applyCoupon);
router.post('/checkout/remove-coupon', userAuth, checkoutController.removeCoupon);
router.post('/checkout/place-order', userAuth, checkoutController.createRazorpayOrder);
router.post('/checkout/verify-payment', userAuth, checkoutController.verifyPayment);
router.post('/checkout/retry-payment', userAuth, checkoutController.retryPayment);
router.post('/checkout/payment-failed', userAuth, checkoutController.paymentFailed);
router.get('/order/success/:orderID', userAuth, checkoutController.successPage);
router.get('/order/failure/:orderID', userAuth, checkoutController.failurePage);
router.get('/edit-address', userAuth, checkoutController.editCheckout);


// Wallet Management
router.get('/wallet', orderController.getWalletDetails);

// Order Management
router.get("/orders", userAuth, orderController.getOrders);
router.get("/orders/:orderId", userAuth, orderController.getOrderDetail);
router.post("/orders/cancel", userAuth, orderController.cancelOrder);
router.post("/orders/return", userAuth, orderController.returnOrder);
router.get("/orders/invoice/:orderId", userAuth, orderController.downloadInvoice);
router.get("/orders/status/:orderId", userAuth, orderController.getOrderStatus);

module.exports = router;