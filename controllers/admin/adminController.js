const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Page Error
const pageerror = (req, res) => {
  res.render("admin-error");
};


const loadLogin = (req, res) => {
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
       req.session.admin = true;
        req.session.user = admin;
        return res.redirect("/admin");
      } else {
        return res.render("admin-login", { message: "Invalid email or password" });
      }
    } else {
      return res.render("admin-login", { message: "Invalid email or password" });
    }

  } catch (error) {
    console.log("login error", error);
    return res.redirect("/pageerror");
  }
};


const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      res.render("dashboard");
      console.log("Admin session:", req.session.admin);
    } catch (error) {
      res.redirect("/pageerror");
    }
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


const getAjaxUsers = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";
    const query = {
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ]
    };

    const users = await User.find(search ? query : {});
    res.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Something went wrong." });
  }
};

module.exports = {
  loadLogin,
  login,
  loadDashboard,
  pageerror,
  logout,
  getAjaxUsers,
};

