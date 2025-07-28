const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema")
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const crypto = require('crypto');
const env = require("dotenv").config();
const session = require("express-session");
const { resendOtp } = require("./userController");
const user = require("../../models/userSchema");
const { log } = require("console");
const { console } = require("inspector");


const securePassword = async (password) => {
  try {

    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
console.error("Error hashing password:", error);
    throw error;
  }
}

function generateOtp() {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

const sendVerificationEmail = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,

      }

    })

    const mailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Your OTP for password reset",
      text: `Your OTP is ${otp}`,
      html: `<b><h4>Your OTP: ${otp}</h4><br></b>`
    }

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    return true;

  } catch (error) {

    console.error("Error sending email", error);
    return false;

  }
}

const getForgotPassPage = async (req, res) => {
  try {
    res.render("forgot-password");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}

const forgotEmailValid = async (req, res) => {
  try {
    const { email } = req.body;
    const findUser = await User.findOne({ email: email });
    if (findUser) {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);
      if (emailSent) {
        req.session.userOtp = otp;
        req.session.email = email;
        res.render("forgotPass-otp");
        console.log("OTP:", otp);
      } else {
        res.json({ success: false, message: "Failed to send OTP. Please try again" });
      }
    } else {
      res.render("forgot-password", {
        message: "User with this email does not exist"
      });
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}

const verifyForgotPassOtp = async (req, res) => {
  try {

    const enteredOtp = req.body.otp;
    if (enteredOtp === req.session.userOtp) {
      res.json({ success: true, redirectUrl: "/reset-password" });
    } else {
      res.json({ success: false, message: "OTP not matching" });
    }

  } catch (error) {
    res.status(500).json({ success: false, message: "An error occured. please try again" });
  }
}

const getResetPassPage = async (req, res) => {
  try {

    res.render("reset-password");

  } catch (error) {
    res.redirect("/pageNotPage");
  }
}

const resendotp = async (req, res) => {
  try {
    const otp = generateOtp();
    req.session.userOtp = otp;
    const email = req.session.email;
    console.log("Resending OTP to email:", email);
    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("Resend OTP:", otp);
      res.status(200).json({ success: true, message: "Resend OTP Successful" });
    }
  } catch (error) {
    console.error("Error in resend otp", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

const postNewPassword = async (req, res) => {
  try {

    const { newPass1, newPass2 } = req.body;
    const email = req.session.email;
    if (newPass1 === newPass2) {
      const passwordHash = await securePassword(newPass1);
      await User.updateOne(
        { email: email },
        { $set: { password: passwordHash } }
      )
      res.redirect("/login");
    } else {
      res.render("reset-password", { message: "passwords do not match" });
    }

  } catch (error) {

  }
}

const changeEmail = async (req, res) => {
  try {
    res.render("change-email")
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}

const changeEmailValid = async (req, res) => {
  try {
    const { email } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);
      if (emailSent) {
        req.session.userOtp = otp;
        req.session.userData = req.body;
        req.session.email = email;
        res.render("change-email-otp");
        console.log("Email sent:", email);
        console.log("OTP:", otp);
      } else {
        res.json("email-error")
      }
    } else {
      res.render("change-email", {
        message: "User with this email not exist"
      })
    }
  } catch (error) {
    res.redirect("/pageNotPage")
  }
}

const verifyEmailOtp = async (req, res) => {
  try {

    const enteredOtp = req.body.otp;
    if (enteredOtp === req.session.userOtp) {
      req.session.userData = req.body.userData;
      res.render("new-email", {
        userData: req.session.userData,
      })
    } else {
      res.render("change-email-otp", {
        message: "OTP not matching",
        userData: req.session.userData
      })
    }

  } catch (error) {
    res.redirect("/pageNotFound");
  }
}

const updateEmail = async (req, res) => {
  try {
    const newEmail = req.body.newEmail;
    const userId = req.session.user;
    await User.findByIdAndUpdate(userId, { email: newEmail });
    res.redirect("/Profile")
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}

const changePassword = async (req, res) => {
  try {
    res.render("change-password")
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}

const changePasswordValid = async (req, res) => {
  try {
    const { currentPassword, newPass1, newPass2 } = req.body;
    const userId = req.session.user._id;

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return res.render("change-password", { message: "User not found" });
    }

    if (!currentPassword || currentPassword.trim() === "") {
      return res.render("change-password", { message: "Current password is required" });
    }
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.render("change-password", { message: "Current password is incorrect" });
    }

    if (!newPass1 || !newPass2) {
      return res.render("change-password", { message: "New passwords are required" });
    }
    const passPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passPattern.test(newPass1)) {
      return res.render("change-password", { message: "New password must be 8+ characters with uppercase, lowercase, number, and special character" });
    }
    if (newPass1 !== newPass2) {
      return res.render("change-password", { message: "New passwords do not match" });
    }
    if (newPass1 === currentPassword) {
      return res.render("change-password", { message: "New password must differ from current password" });
    }

    const passwordHash = await securePassword(newPass1);
    await User.findByIdAndUpdate(userId, { password: passwordHash });

    res.render("change-password", { successMessage: "Password changed successfully" });
  } catch (error) {
    console.error("Error in change password validation:", error);
    res.render("change-password", { message: "An error occurred. Please try again." });
  }
};



module.exports = {
  getForgotPassPage,
  forgotEmailValid,
  verifyForgotPassOtp,
  getResetPassPage,
  resendotp,
  postNewPassword,
  changeEmail,
  changeEmailValid,
  verifyEmailOtp,
  updateEmail,
  changePassword,
  changePasswordValid,
}