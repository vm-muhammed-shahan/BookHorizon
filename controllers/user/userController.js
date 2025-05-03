const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require('bcrypt');


// Page not Found 
const pageNotFound = async (req, res) => {
  try {
    res.render("page-404");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}


// LoadHomePage  
const loadHomepage = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true });
    let productData = await Product.find({
      isBlocked: false,
      quantity: { $gt: 0 }
    }).populate('category')
      .sort({ createdAt: -1 })
      .limit(4);
    if (req.session.user) {
      const userData = await User.findOne({ _id: req.session.user._id });
    if (userData) {
      return res.render("home", { user: userData, products: productData });
     
    }
    
    } else {
      return res.render("home",{user: req.session.user || null, products: productData});
    }
  } catch (error) {
    console.error("Home page error:", error.message);
    res.status(500).send("Server error");
  }
};


// LoadSignup 
const loadSignup = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    console.log("Home page not loading:", error);
    res.status(500).send("server Error")
  }
}

//Generate Otp
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
async function sendVerificationEmail(email, otp) {
  try {
    console.log("Email before sending:", email);
    if (!email) {
      throw new Error("Recipient email is missing or invalid  .");
    }
    console.log("user:", process.env.NODEMAILER_EMAIL)
    console.log("pass:", process.env.NODEMAILER_PASSWORD)
    const transporter = nodemailer.createTransport({
      service: "gmail",
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
      subject: "verify your email account",
      text: `your OTP is ${otp}`,
      html: `<b>your OTP: ${otp}</b>`
    })
    return info.accepted.length > 0
  } catch (error) {
    console.error("sent verification mail failed", error)
    return false
  }
}


// Signip
const signup = async (req, res) => {
  try {
    const { name, email, phone, password, confirm_password } = req.body;
    console.log("email:", email);
    console.log("password:", password);
    console.log("conformpassword:", confirm_password);
    console.log("name:", name);
    if (password !== confirm_password) {
      return res.render("signup", { message: "Passwords do not match" });
    }
    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("signup", { message: "User with this email already exist" });
    }
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    console.log("emailsent:", emailSent);
    if (!emailSent) {
      return res.json("email-error")
    }
    req.session.userOtp = otp;
    req.session.userData = { name, phone, email, password };
    console.log("OTP Sent Successfully", otp);
    return res.render("verify-otp", { email });
  } catch (error) {
    console.error("signup error", error);
    res.redirect("/pageNotFound");
  }
}


// SecurePassword
const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10)
    return passwordHash;
  } catch (error) {
    console.error("Error hashing password:", error);
    throw error;
  }
}


// VerifyOtp
const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log(otp);
    if (otp === req.session.userOtp) {
      const user = req.session.userData
      const passwordHash = await securePassword(user.password);
      const saveUserData = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: passwordHash,
      })
      await saveUserData.save();
      req.session.user = { _id: saveUserData._id };
      delete req.session.userData;
      delete req.session.userOtp;
      return res.status(200).json({ success: true, redirectUrl: "/login" })
    } else {
      res.status(400).json({ success: false, message: "Invalid OTP, Please try again" })
    }
  } catch (error) {
    console.error("Error Verifying OTP", error);
    res.status(500).json({ success: false, message: "An error occured" })
  }
}


// Resendotp
const resendOtp = async (req, res) => {
  try {
    if (!req.session.userData || !req.session.userData.email) {
      return res.status(400).json({ success: false, message: "Session expired. Please sign up again." });
    }
    const { email } = req.session.userData;
    const otp = generateOtp();
    req.session.userOtp = otp;
    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("Resent OTP:", otp);
      res.status(200).json({ success: true, message: "OTP Resent Successfully" });
    } else {
      res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again." });
    }
  } catch (error) {
    console.error("Error resending OTP", error);
    res.status(500).json({ success: false, message: "Internal Server Error. Please try again." });
  }
};


// Loadlogin
const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("login")
    } else {
      res.redirect("/")
    }
  } catch (error) {
    res.redirect("/pageNotFound")
  }
}
// Login
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


// Logout
const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("session destruction error", err.message);
        return res.redirect("/pageNotFound");
      }
      return res.redirect("/login")
    })
  } catch (error) {
    console.log("Logout error", error);
    res.redirect("/pageNotFound");
  }
}


// LoadShoppingPage
const loadShoppingPage = async (req, res) => {
  console.log("shop page loaded");
  try {
    const user = req.session.user;
    const userData = user ? await User.findOne({ _id: user._id }) : null;
    const categories = await Category.find({ isListed: true });
    const categoryIds = categories.map((category) => category._id.toString());
    const selectedCategory = req.query.category || null;
    const sortOption = req.query.sort || null;
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;


    const query = {
      isBlocked: false,
      // quantity: { $gt: 0 },
    };
    if (selectedCategory) {
      query.category = selectedCategory;
    } else {
      query.category = { $in: categoryIds };
    }



    let sortQuery = { createdAt: -1 }; // Default: latest

    if (sortOption === 'lowToHigh') {
      sortQuery = { salePrice: 1 }; // ascending price
    } else if (sortOption === 'highToLow') {
      sortQuery = { salePrice: -1 }; // descending price
    } else if (sortOption === 'aToZ') {
      sortQuery = { productName: 1 }; // ascending name
    } else if (sortOption === 'zToA') {
      sortQuery = { productName: -1 }; // descending name
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
    res.render("shop", {
      user: userData,
      products: products,
      category: categoriesWithIds,
      totalProducts: totalproducts,
      currentPage: page,
      totalPages: totalPages,
      selectedCategory: selectedCategory,
      sortOption: sortOption 
    });
  } catch (error) {
    console.log("Error loading shop:", error);
    res.status(500).render("errorPage", { message: "Something went wrong" });
  }
};


// FilterProduct
const filterProduct = async (req, res) => {
  try {
    console.log("Filtering products by category");
    const user = req.session.user;
    const selectedCategory = req.query.category;
    console.log("Category ID:", selectedCategory);
    const findCategory = selectedCategory ? await Category.findOne({ _id: selectedCategory }) : null;
    if (selectedCategory && !findCategory) {
      console.log("Category not found");
      return res.redirect("/shop");
    }
    const query = {
      isBlocked: false,
      quantity: { $gt: 0 }
    };
    if (findCategory) {
      query.category = findCategory._id;
    }
    console.log("Query:", JSON.stringify(query));
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const totalproducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalproducts / limit);
    const categories = await Category.find({ isListed: true });
    let userData = null;
    if (user && user._id) {
      userData = await User.findOne({ _id: user._id });
      if (userData) {
        const searchEntry = {
          category: findCategory ? findCategory._id : null,
          searchedOn: new Date(),
        };
        userData.searchHistory.push(searchEntry);
        await userData.save();
      }
    }
    res.render('shop', {
      user: userData,
      products: products,
      category: categories,
      totalPages,
      currentPage: page,
      selectedCategory: selectedCategory,
      sortOption: "",
    });
  } catch (error) {
    console.log("Filter product error:", error);
    res.redirect("/pageNotFound");
  }
};


const filterByprice = async (req, res) => {
  try {
    console.log("Filtering by price");
    console.log("Price range:", req.query.gt, "-", req.query.lt);
    const user = req.session.user;
    const userData = user && user._id ? await User.findOne({ _id: user._id }) : null;
    const categories = await Category.find({ isListed: true }).lean();
    
    const minPrice = parseFloat(req.query.gt);
    const maxPrice = parseFloat(req.query.lt);
    const selectedCategory = req.query.category;

    let query = {
      salePrice: { $gte: minPrice, $lte: maxPrice },
      isBlocked: false,
      quantity: { $gt: 0 }
    };

    if (selectedCategory) {
      query.category = selectedCategory;
    }

    console.log("Price filter query:", JSON.stringify(query));
    
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalproducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalproducts / limit);

    res.render("shop", {
      user: userData,
      products: products,
      category: categories,
      totalPages,
      currentPage: page,
      selectedCategory: selectedCategory, // <-- Pass category back for pagination
      sortOption: "",
    });
  } catch (error) {
    console.log("Filter by price error:", error);
    res.redirect("/pageNotFound");
  }
};







// SearchProducts
const searchProducts = async (req, res) => {
  try {
    console.log("Searching products");
    console.log("Search query:", req.body.query);
    const user = req.session.user;
    const userData = user && user._id ? await User.findOne({ _id: user._id }) : null;
    let search = req.body.query;
    const categories = await Category.find({ isListed: true }).lean();
    const categoryIds = categories.map(category => category._id.toString());
    const query = {
      productName: { $regex: ".*" + search + ".*", $options: "i" },
      isBlocked: false,
      quantity: { $gt: 0 },
      category: { $in: categoryIds }
    };
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const totalproducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalproducts / limit);
    console.log(`Found ${totalproducts} products matching search`);
    res.render("shop", {
      user: userData,
      products: products,
      category: categories,
      totalPages,
      currentPage: page,
      selectedCategory: null,
      searchQuery: search,
      sortOption: "",
    });
  } catch (error) {
    console.log("Search products error:", error);
    res.redirect("/pageNotFound");
  }
};


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
  loadShoppingPage,
  filterProduct,
  filterByprice,
  searchProducts,
};








