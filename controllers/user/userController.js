const User = require("../../models/userSchema");
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { session } = require("passport");
const offerController = require("../admin/offerController");
const http = require("../../helpers/const");
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.error("Error hashing password:", error);
    throw error;
  }
};
async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({

      service: 'gmail',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    })

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP ${otp}</b>`,
    })
    return info.accepted.length > 0
  } catch (error) {
    console.error("Error sending email", error);
    return false;

  }
}









const pageNotFound = async (req, res) => {
  try {
    res.render("error");
  } catch (error) {
    res.redirect("/pageNotFound");
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
      res.render("reset-password", { message: 'passwords do not match' });
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}

const loadHomepage = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true });
    let productData = await Product.find({
      isBlocked: false,
    }).populate('category')
      .sort({ createdAt: -1 })
      .limit(8);
    if (req.session.user) {
      const userData = await User.findOne({ _id: req.session.user._id });
      if (userData) {
        return res.render("home", { user: userData, products: productData });
      }
    } else {
      return res.render("home", { user: req.session.user || null, products: productData });
    }
  } catch (error) {
    console.error("Home page error:", error.message);
    res.status(http.Internal_Server_Error).send("Server error");
  }
};

const loadSignup = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    res.status(http.Internal_Server_Error).send("server Error")
  }
}

const signup = async (req, res) => {
  try {
    const { name, phone, email, password, cpassword } = req.body;

    const namePattern = /^[A-Za-z\s]{2,50}$/;
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const phonePattern = /^[6-9]\d{9}$/;
    const passPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!name || !phone || !email || !password || !cpassword) {
      return res.render("signup", { message: "All fields are required" });
    }

    if (!namePattern.test(name)) {
      return res.render("signup", { message: "Name must be 2-50 characters, letters and spaces only" });
    }

    if (!emailPattern.test(email)) {
      return res.render("signup", { message: "Invalid email format" });
    }

    if (!phonePattern.test(phone)) {
      return res.render("signup", { message: "Phone number must be 10 digits and start with 6-9" });
    }

    if (/^(\d)\1{9}$/.test(phone) || phone === "1234567890") {
      return res.render("signup", { message: "Invalid phone number" });
    }

    if (!passPattern.test(password)) {
      return res.render("signup", {
        message: "Password must be 8+ characters with uppercase, lowercase, number, and special character",
      });
    }

    if (password !== cpassword) {
      return res.render("signup", { message: "Passwords do not match" });
    }

    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("signup", { message: "User with this email already exists" });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.render("signup", { message: "Failed to send OTP. Please try again." });
    }

    req.session.userOtp = otp;
    req.session.userData = { name, phone, email, password };

    res.render("verify-otp");
  } catch (error) {
    console.error("Signup error:", error);
    res.render("signup", { message: "An error occurred. Please try again." });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    if (otp === req.session.userOtp) {
      const user = req.session.userData;
      const passwordHash = await securePassword(user.password);

      const saveUserData = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: passwordHash,
      });
      await saveUserData.save();

      req.session.userOtp = null;
      req.session.userData = null;

      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error("Error saving session:", err);
            return reject(err);
          }
          resolve();
        });
      });

      res.json({ success: true, redirectUrl: "/login" });
    } else {
      res.status(http.Bad_Request).json({ success: false, message: "Invalid OTP, please try again" });
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(http.Internal_Server_Error).json({ success: false, message: "An error occurred. Please try again." });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData;
    if (!email) {
      return res.status(http.Bad_Request).json({ success: false, message: "Email not found in session" })
    }

    const otp = generateOtp()
    req.session.userOtp = otp;

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("Resend OTP:", otp);
      res.status(http.OK).json({ success: true, message: "OTP Resend Successfull" })
    } else {
      res.status(http.Internal_Server_Error).json({ success: false, message: "Failed to resend OTP. Please try again" });
    }

  } catch (error) {
    console.error("Error resending OTP", error);
    res.status(http.Internal_Server_Error).json({ success: false, message: "Internal Server Error. Please try again." });
  }
};

const loadLogin = async (req, res) => {
  try {
    if (req.session.user) {
      return res.redirect("/");
    }
    req.session.user = null;
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error("Error saving session:", err);
          return reject(err);
        }
        resolve();
      });
    });
    return res.render("login", { message: "" });
  } catch (error) {
    console.error("Error loading login page:", error);
    res.redirect("/pageNotFound");
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const findUser = await User.findOne({ isAdmin: false, email: email });
    if (!findUser) {
      return res.render("login", { message: "User not found" })
    }
    if (findUser.isBlocked === true) {
      return res.render("login", { message: "User is blocked by admin" })
    }
    const passwordMatch = await bcrypt.compare(password, findUser.password);
    if (!passwordMatch) {
      return res.render("login", { message: "Incorrect Password" })
    }
    req.session.user = {
      _id: findUser._id,
    };
    res.redirect("/");
  } catch (error) {
    console.error("login error:", error.message);
    res.render("login", { message: "login failed.please try again later" });
  }
}

const logout = (req, res) => {
  if (req.session.user) {
    delete req.session.user;             
    res.clearCookie("connect.sid");       
  }
  res.redirect("/login");
};

const filterProduct = async (req, res) => {
  try {
    const user = req.session.user;
    const selectedCategories = req.query.category ? (Array.isArray(req.query.category) ? req.query.category : [req.query.category]) : [];
    const sortOption = req.query.sort || "";
    const searchQuery = req.query.query || "";
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;

    const validCategories = selectedCategories.length > 0 ? await Category.find({ _id: { $in: selectedCategories }, isListed: true }) : [];
    if (selectedCategories.length > 0 && validCategories.length === 0) {
      return res.redirect("/shop");
    }

    let redirectUrl = "/shop?";
    if (selectedCategories.length > 0) {
      redirectUrl += selectedCategories.map(cat => `category=${cat}`).join('&');
    }
    if (sortOption) redirectUrl += `${selectedCategories.length > 0 ? '&' : ''}sort=${sortOption}`;
    if (searchQuery) redirectUrl += `${selectedCategories.length > 0 || sortOption ? '&' : ''}query=${encodeURIComponent(searchQuery)}`;
    if (maxPrice) redirectUrl += `${selectedCategories.length > 0 || sortOption || searchQuery ? '&' : ''}maxPrice=${maxPrice}`;

    if (user && user._id) {
      const userData = await User.findOne({ _id: user._id });
      if (userData) {
        const searchEntry = {
          category: validCategories.length > 0 ? validCategories[0]._id : null,
          searchedOn: new Date(),
        };
        userData.searchHistory.push(searchEntry);
        await userData.save();
      }
    }
    return res.redirect(redirectUrl);
  } catch (error) {
    console.log("Filter product error:", error);
    res.redirect("/pageNotFound");
  }
};

const filterByprice = async (req, res) => {
  try {
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
    const selectedCategories = req.query.category ? (Array.isArray(req.query.category) ? req.query.category : [req.query.category]) : [];
    const sortOption = req.query.sort || "";
    const searchQuery = req.query.query || "";

    let redirectUrl = "/shop?";
    if (maxPrice) redirectUrl += `maxPrice=${maxPrice}`;
    if (selectedCategories.length > 0) redirectUrl += `${maxPrice ? '&' : ''}${selectedCategories.map(cat => `category=${cat}`).join('&')}`;
    if (sortOption) redirectUrl += `${maxPrice || selectedCategories.length > 0 ? '&' : ''}sort=${sortOption}`;
    if (searchQuery) redirectUrl += `${maxPrice || selectedCategories.length > 0 || sortOption ? '&' : ''}query=${encodeURIComponent(searchQuery)}`;

    return res.redirect(redirectUrl);
  } catch (error) {
    console.log("Filter by price error:", error);
    res.redirect("/pageNotFound");
  }
};

const searchProducts = async (req, res) => {
  try {
    const searchQuery = req.query.query;
    const selectedCategories = req.query.category ? (Array.isArray(req.query.category) ? req.query.category : [req.query.category]) : [];
    const sortOption = req.query.sort || "";
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;

    let redirectUrl = `/shop?query=${encodeURIComponent(searchQuery)}`;
    if (selectedCategories.length > 0) redirectUrl += `&${selectedCategories.map(cat => `category=${cat}`).join('&')}`;
    if (sortOption) redirectUrl += `&sort=${sortOption}`;
    if (maxPrice) redirectUrl += `&maxPrice=${maxPrice}`;

    return res.redirect(redirectUrl);
  } catch (error) {
    console.log("Search products error:", error);
    res.redirect("/pageNotFound");
  }
};

const updatedLoadShoppingPage = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = user ? await User.findOne({ _id: user._id }) : null;
    const categories = await Category.find({ isListed: true });
    const categoryIds = categories.map((category) => category._id.toString());
    const selectedCategories = req.query.category ? (Array.isArray(req.query.category) ? req.query.category : [req.query.category]) : [];
    const sortOption = req.query.sort || null;
    const searchQuery = req.query.query || null;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const query = {
      isBlocked: false,
    };

    if (selectedCategories.length > 0) {
      query.category = { $in: selectedCategories };
    } else {
      query.category = { $in: categoryIds };
    }

    if (searchQuery) {
      query.productName = { $regex: ".*" + searchQuery + ".*", $options: "i" };
    }

    if (maxPrice !== null) {
      query.salePrice = { $lte: maxPrice };
    }

    let sortQuery = { createdAt: -1 };
    if (sortOption === 'lowToHigh') {
      sortQuery = { salePrice: 1 };
    } else if (sortOption === 'highToLow') {
      sortQuery = { salePrice: -1 };
    } else if (sortOption === 'aToZ') {
      sortQuery = { productName: 1 };
    } else if (sortOption === 'zToA') {
      sortQuery = { productName: -1 };
    }

    const products = await Product.find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(limit);

    const totalproducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalproducts / limit);

    const categoriesWithIds = categories.map((category) => ({
      _id: category._id,
      name: category.name,
    }));

    let queryString = '';
    if (selectedCategories.length > 0) queryString += selectedCategories.map(cat => `category=${cat}`).join('&');
    if (sortOption) queryString += `${queryString ? '&' : ''}sort=${sortOption}`;
    if (searchQuery) queryString += `${queryString ? '&' : ''}query=${encodeURIComponent(searchQuery)}`;
    if (maxPrice) queryString += `${queryString ? '&' : ''}maxPrice=${maxPrice}`;

    res.render("shop", {
      user: userData,
      products: products,
      categories: categoriesWithIds,
      totalProducts: totalproducts,
      currentPage: page,
      totalPages: totalPages,
      selectedCategories: selectedCategories,
      sortOption: sortOption,
      searchQuery: searchQuery,
      maxPrice: maxPrice,
      queryString: queryString
    });
  } catch (error) {
    console.log("Error loading shop:", error);
    res.status(http.Internal_Server_Error).render("errorPage", { message: "Something went wrong" });
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId);
    const addressDoc = await Address.findOne({ userId });
    res.render("profile", {
      user,
      addresses: addressDoc?.address || [],
    });
  } catch (err) {
    console.error("Error loading profile", err);
    res.status(http.Internal_Server_Error).send("Server Error");
  }
};

const editProfilePage = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    res.render("editProfile", { user, errors: {} });
  } catch (err) {
    console.error("Error loading edit profile", err);
    res.status(http.Internal_Server_Error).send("Server Error");
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const trimmedName = name?.trim();
    const trimmedPhone = phone?.trim();

    const repeatedPhones = new Set([
      '0000000000','1111111111','2222222222','3333333333',
      '4444444444','5555555555','6666666666','7777777777',
      '8888888888','9999999999','1234567890'
    ]);

    const namePattern = /^[A-Za-z\s]{2,50}$/;
    const phonePattern = /^[6-9]\d{9}$/;

    const errors = {};

    if (!trimmedName || !namePattern.test(trimmedName)) {
      errors.name = "Name must be 2-50 characters, letters and spaces only.";
    }

    if (!trimmedPhone || !phonePattern.test(trimmedPhone) || repeatedPhones.has(trimmedPhone)) {
      errors.phone = "Phone number must be 10 digits, start with 6-9, and not repeated numbers.";
    }

    if (Object.keys(errors).length > 0) {
      console.log('Validation Errors:', errors);
      return res.status(http.Bad_Request).json({ errors });
    }

    const user = await User.findById(req.session.user._id);
    user.name = trimmedName;
    user.phone = trimmedPhone;
    await user.save();

    req.session.user.name = trimmedName;
    req.session.user.phone = trimmedPhone;
    await new Promise((resolve, reject) => {
      req.session.save(err => err ? reject(err) : resolve());
    });

    req.session.successMessage = 'Profile Updated Successfully';
    res.redirect('/profile');
  } catch (err) {
    console.error("Error updating profile", err);
    res.status(http.Internal_Server_Error).json({ error: "Server Error" });
  }
};


const changePassword = async (req, res) => {
  try {
    res.render("change-password")
  } catch (error) {
    res.redirect("/pageNotFound")
  }
}

const changePasswordValid = async (req, res) => {
  try {
    const { email } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp)
      if (emailSent) {
        req.session.userOtp = otp;
        req.session.userData = req.body;
        req.session.email = email;
        res.render("change-password-otp", {
          user: req.session.user || null
        });
        console.log("OTP:", otp);
      } else {
        res.json({
          success: false,
          message: "Failed to send otp. please try again"
        })
      }
    } else {
      res.render("change-password", {
        message: "User with this email does not exist",
        user: req.session.user || null
      })
    }
  } catch (error) {
    console.log("Error in change password validation", error);
    res.redirect("/pageNotFound");
  }
}









module.exports = {
  loadHomepage,
  loadSignup,
  signup,
  verifyOtp,
  resendOtp,
  loadLogin,
  pageNotFound,
  login,
  logout,
  loadShoppingPage: updatedLoadShoppingPage,
  filterProduct,
  filterByprice,
  searchProducts,
  postNewPassword,
  getProfile,
  editProfilePage,
  updateProfile,

};
