const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Page Error
const pageerror = (req, res) => {
  res.render("admin-error");
};



const loadLogin = (req, res) => {
  // console.log(req.session.admin)
  if (req.session.admin) {
    return res.redirect("/");
  }
  res.render("admin-login", { message: null });
};


const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });
    if (admin) { 
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = admin;
        // console.log(req.session.admin)
        return res.redirect("/admin/dashboard");
      } else {
        return res.render("admin-login", { message: "Invalid password" });
      }
    } else {
      return res.render("admin-login", { message: "Invalid email" });
    }
  } catch (error) {
    console.log("login error", error);
    return res.redirect("/pageerror");
  }
};


const logout = async (req, res) => {
  try {
    req.session.destroy(err => {
      if (err) {
        console.log("Error destroying session", err);
        return res.redirect("/pageerror");
      }
      res.redirect("/admin/login");
    });
  } catch (error) {
    console.log("unexpected error during logout", error);
    res.redirect("/pageerror");
  }
};


module.exports = {
  loadLogin,
  login,
  pageerror,
  logout,
};

