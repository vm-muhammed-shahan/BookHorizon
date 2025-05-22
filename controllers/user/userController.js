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











// Page not Found 
const pageNotFound = async (req, res) => {
  try {
    res.render("page-404");
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







// LoadHomePage  
const loadHomepage = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true });
    let productData = await Product.find({
      isBlocked: false,
      // quantity: { $gt: 0 }
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
    // console.log("email:", email);
    // console.log("password:", password);
    // console.log("conformpassword:", confirm_password);
    // console.log("name:", name);
    if (password !== confirm_password) {
      return res.render("signup", { message: "Passwords do not match" });
    }
    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("signup", { message: "User with this email already exist" });
    }
    if (!/^\d{10}$/.test(req.body.phone)) {
      return res.render("signup",{ message: 'Invalid phone number' });
    }
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    // console.log("emailsent:", emailSent);
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
    // console.log(otp);
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




const filterProduct = async (req, res) => {
  try {
    // console.log("Filtering products by category");
    const user = req.session.user;
    const selectedCategory = req.query.category;
    const sortOption = req.query.sort || "";
    const searchQuery = req.query.query || "";

    // console.log("Category ID:", selectedCategory);
    const findCategory = selectedCategory ? await Category.findOne({ _id: selectedCategory }) : null;
    if (selectedCategory && !findCategory) {
      console.log("Category not found");
      return res.redirect("/shop");
    }
    let redirectUrl = `/shop?category=${selectedCategory}`;
    if (sortOption) redirectUrl += `&sort=${sortOption}`;
    if (searchQuery) redirectUrl += `&query=${encodeURIComponent(searchQuery)}`;
    if (user && user._id) {
      const userData = await User.findOne({ _id: user._id });
      if (userData) {
        const searchEntry = {
          category: findCategory ? findCategory._id : null,
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

    // console.log("Price range:", req.query.gt, "-", req.query.lt);
    const minPrice = parseFloat(req.query.gt);
    const maxPrice = parseFloat(req.query.lt);
    const selectedCategory = req.query.category || null;
    const sortOption = req.query.sort || "";
    const searchQuery = req.query.query || "";
    let redirectUrl = `/shop?`;
    redirectUrl += `priceMin=${minPrice}&priceMax=${maxPrice}`;
    if (selectedCategory) redirectUrl += `&category=${selectedCategory}`;
    if (sortOption) redirectUrl += `&sort=${sortOption}`;
    if (searchQuery) redirectUrl += `&query=${encodeURIComponent(searchQuery)}`;
    return res.redirect(redirectUrl);
  } catch (error) {
    console.log("Filter by price error:", error);
    res.redirect("/pageNotFound");
  }
};

const searchProducts = async (req, res) => {
  try {
    const searchQuery = req.query.query;
    // console.log("Search query:", searchQuery);
    const selectedCategory = req.query.category || null;
    const sortOption = req.query.sort || "";
    let redirectUrl = `/shop?query=${encodeURIComponent(searchQuery)}`;
    if (selectedCategory) redirectUrl += `&category=${selectedCategory}`;
    if (sortOption) redirectUrl += `&sort=${sortOption}`;

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
    const selectedCategory = req.query.category || null;
    const sortOption = req.query.sort || null;
    const searchQuery = req.query.query || null;
    const priceMin = req.query.priceMin ? parseFloat(req.query.priceMin) : null;
    const priceMax = req.query.priceMax ? parseFloat(req.query.priceMax) : null;
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
    if (searchQuery) {
      query.productName = { $regex: ".*" + searchQuery + ".*", $options: "i" };
    }
    if (priceMin !== null && priceMax !== null) {
      query.salePrice = { $gte: priceMin, $lte: priceMax };
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

    res.render("shop", {
      user: userData,
      products: products,
      category: categoriesWithIds,
      totalProducts: totalproducts,
      currentPage: page,
      totalPages: totalPages,
      selectedCategory: selectedCategory,
      sortOption: sortOption,
      searchQuery: searchQuery,
      priceMin: priceMin,
      priceMax: priceMax
    });
  } catch (error) {
    console.log("Error loading shop:", error);
    res.status(500).render("errorPage", { message: "Something went wrong" });
  }
};





//profile controller 



const getProfile = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId);
    const addressDoc = await Address.findOne({ userId });

    res.render("profile", {
      user,
      addresses: addressDoc?.address || []
    });
  } catch (err) {
    console.error("Error loading profile", err);
    res.status(500).send("Server Error");
  }
};




const editProfilePage = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    res.render("editProfile", { user });
  } catch (err) {
    console.error("Error loading edit profile", err);
    res.status(500).send("Server Error");
  }
};


const updateProfile = async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    const user = await User.findById(req.session.user._id);
    user.name = name;
    user.phone = phone;
    await user.save();

    res.redirect("/profile");
  } catch (err) {
    console.error("Error updating profile", err);
    res.status(500).send("Server Error");
  }
};




const changePassword = async (req,res)=>{
  try {
    
    res.render("change-password")

  } catch (error) {
    
     res.redirect("/pageNotPage")

  }
}





const changePasswordValid = async(req,res)=>{
  try {
     const {email} = req.body;
     const userExists = await User.findOne({email});
     if(userExists){
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email,otp)
      if(emailSent){
        req.session.userOtp = otp;
        req.session.userData = req.body;
        req.session.email = email;
        res.render("change-password-otp",{
           user: req.session.user || null
        });
        console.log("OTP:", otp);
        
      }else{
        res.json({
          success:false,
          message: "Failed to send otp. please try again"
        })
      }
     }else {
      res.render("change-password",{
        message: "User with this emal does not  exist",
         user: req.session.user || null
      
      })
     }
  } catch (error) {
    console.log("Error in change password validation", Error);
    res.redirect("/pageNotFound");
  }
}






const verifyChangePassOtp = async (req,res) => {
  try {
    
    const enteredOtp = req.body.otp;
    if(enteredOtp=== req.session.userOtp){

     res.json({success:true, redirectUrl:"/reset-password"})

    }else {
      res.json({success: false, message: "OTP not matching"})
    }

  } catch (error) {
    res.status(500).json({success:false, message: "An error occured.please try again later"})
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
changePassword,
changePasswordValid,
verifyChangePassOtp,

};
