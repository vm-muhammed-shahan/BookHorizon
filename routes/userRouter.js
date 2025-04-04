const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/user/userController');


 router.get("/pageNotFound",userController.pageNotFound);


// router.get('/', userController.loadHomepage); 
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

  router.get("/login",userController.loadLogin);
  router.post("/login",userController.login);

  router.get("/",userController.loadHomepage);
  router.get("/logout",userController.logout);



  router.use((req, res, next) => {
    console.log("Session User:", req.session.user);
    next();
});

module.exports = router;
