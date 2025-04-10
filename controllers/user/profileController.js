const User = require("../../models/userSchema");
const nodemailer = require ("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session");
const { resendOtp } = require("./userController");
const user = require("../../models/userSchema");


function generateOtp(){
  const digits = "123456789";
  let otp = "";
  for(let i = 0; i < 6; i++){
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}



const sendVerificationEmail = async(email,otp)=>{
  try {
    const  transporter = nodemailer.createTransport({
     service: "gmail",
     port:587,
     secure:false,
     requireTLS:true,
     auth:{
      user:process.env.NODEMAILER_EMAIL,
      pass:process.env.NODEMAILER_PASSWORD,

     }

    })




const mailOptions = {
  from:process.env.NODEMAILER_EMAIL,
  to:email,
  subject:"Your OTP for password reset",
  text: `Your OTP is ${otp}`,
  html: `<b><h4>Your OTP: ${otp}</h4><br></b>`
}

const info = await  transporter.sendMail(mailOptions);
console.log("Email sent:", info.messageId);
return true;

  } catch (error) {
      
     console.error("Error sending email",error);
     return false;

  }
}



const securePassword =  async(password)=>{
   try {
    const passwordHash = await  bcrypt.hash(password,10);
   return passwordHash;

   } catch (error) {
    
   }
}

const getForgotPassPage = async (req,res)=>{
  try {
    const user = req.session.user
   return res.render("forgot-password",{user});
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}


const forgotEmailValid = async(req,res)=>{
try {
  const {email} = req.body;
  const findUser = await User.findOne({email:email});
  if(findUser){
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email,otp);
    if(emailSent){
      req.session.userOtp = otp;
      req.session.email = email;
      console.log("OTP:",otp);
      res.render("forgotPass-otp",{user:findUser});
      

    }else {
         res.json({success:false, message: "Failed to send OTP, Please try again"});
    }    
  }else {
    res.render("forgot-password",{
      message: "User with this email does not exist"
    });
  }
} catch (error) {
  res.redirect("/pageNotFound");
}
} 

const verifyForgotPassOtp = async(req,res)=>{
  try {
    
    const enteredOtp = req.body.otp;
    console.log("Entered OTP:",enteredOtp);
    console.log("Session OTP:",req.session.userOtp);
    if(enteredOtp == req.session.userOtp){
      res.status(200).json({success: true,redirectUrl:"/reset-password"});
    }else {
      res.json({success:false,message: "OTP not matching"});
    }

  } catch (error) {
    res.status(500).json({success:false,message:"An error occured. please try again"});
  }
}

const getResetPassPage = async(req,res)=>{
  try {
    res.render("reset-password",{user:req.session.user});

  } catch (error) {
    res.redirect("/pageNotFound"); 

  }
}

const resendOTP = async(req,res)=>{
    try {
      
      const otp = generateOtp()
        req.session.userOtp = otp;
        const email = req.session.email;
        console.log("Resending OTP to email:",email);
        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
          console.log("Resend OTP:", otp);
          res.status(200).json({success:true, message:"Resend OTP Successful"});
        }
      

    } catch (error) {

      console.error("Error in resend otp",error);
      res.status(500).json({success:false, message: 'Internal Server Error'});
      
    }
}


const postNewPassword = async (req,res)=>{
  try {
    const {newPass1, newPass2} = req.body;
    const email = req.session.email;
    if(newPass1===newPass2){
      const passwordHash = await securePassword(newPass1);
      await User.updateOne(
        {email:email},
        {$set:{password:passwordHash}}
      )
      res.redirect("/login");
    }else {
      res.render("reset-password",{message: 'passwords do not match'});
    }
  } catch (error) {
    

    res.redirect("/pageNotFound");
  }
}

module.exports = {
  getForgotPassPage,
  forgotEmailValid,
  verifyForgotPassOtp,
  getResetPassPage,
  resendOtp,
  postNewPassword,
}