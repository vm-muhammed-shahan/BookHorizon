const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");

const productDetails = async (req, res) => {
  try {
  
    const user = req.session.user;
    const userData = user ? await User.findById(user._id) : null;
    
    const productId = req.query.id;
    console.log("Fetching product details for:", productId);
    
    if (!productId) {
      console.log("No product ID provided");
      return res.redirect("/shop");
    }
    
  
    const product = await Product.findById(productId);
    if (Array.isArray(product.productImage)) {
      product.productImage = [...new Set(product.productImage)];
    }
    console.log(product.productImage);
    
    if (!product) {
      console.log("Product not found");
      return res.redirect("/shop");
    }


     if (product.isBlocked ) {
      console.log("Product is blocked or out of stock");
      return res.redirect("/shop");
    }

    if (Array.isArray(product.productImage)) {
      product.productImage = [...new Set(product.productImage)];
    }
    
    const category = await Category.findById(product.category);
    
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id }, 
      isBlocked: false,
      quantity: { $gt: 0 }
    }).limit(4);
    
    res.render("product-details", {
      user: userData,
      product: product,
      quantity: product.quantity,
      category: category,
      relatedProducts: relatedProducts
    });
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.redirect("/pageNotFound");
  }
};

module.exports = {
  productDetails,
};















