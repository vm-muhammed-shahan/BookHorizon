const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Offer = require("../../models/offerSchema");
const { applyBestOffer } = require("../admin/productController");

 const productDetails = async (req, res) => {
 try {
    const user = req.session.user;
    const userData = user ? await User.findById(user._id) : null;
    const productId = req.query.id;
    if (!productId) {
      console.log("No product ID provided");
      return res.redirect("/shop");
    }
    let product = await Product.findById(productId).populate('category');
    if (Array.isArray(product.productImage)) {
      product.productImage = [...new Set(product.productImage)];
    }
    if (!product) {
      console.log("Product not found");
      return res.redirect("/shop");
    }
    if (product.isBlocked) {
      console.log("Product is blocked or out of stock");
      return res.redirect("/shop");
    }

    // Fetch the latest active offers for both product and category
    const currentDate = new Date();
    const offers = await Offer.find({
      $or: [
        { offerType: 'product', applicableId: product._id },
        { offerType: 'category', applicableId: product.category._id }
      ],
      isActive: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate },
    }).lean();

    // Apply best offer and update product if necessary
    const { discountedPrice, bestDiscount, bestOfferType } = await applyBestOffer(product, offers);
    if (discountedPrice !== product.salePrice || !product.salePrice) {
      product.salePrice = discountedPrice;
      // Update categoryOffer based on the best offer
      const categoryOfferDoc = offers.find(offer => 
        offer.offerType === 'category' && 
        offer.applicableId.toString() === product.category._id.toString() && 
        offer.isActive
      );
      product.categoryOffer = categoryOfferDoc ? categoryOfferDoc.discountPercentage : 0;
      await product.save(); // Persist the updated categoryOffer
    }

    const category = product.category;
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id }, 
      isBlocked: false,
      quantity: { $gt: 0 }
    }).limit(4);

    // Identify the best offer for display
    const productOffer = offers.find(offer => 
      offer.offerType === 'product' && 
      offer.applicableId.toString() === product._id.toString() &&
      offer.discountPercentage === bestDiscount
    );
    const categoryOffer = offers.find(offer => 
      offer.offerType === 'category' && 
      offer.applicableId.toString() === product.category._id.toString() &&
      offer.discountPercentage === bestDiscount
    );

    res.render("product-details", {
      user: userData,
      product: product,
      quantity: product.quantity,
      category: category,
      relatedProducts: relatedProducts,
      productOffer: productOffer || null,
      categoryOffer: categoryOffer || { discountPercentage: product.categoryOffer }, // Fallback to product.categoryOffer
      bestDiscount: bestDiscount
    });
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.redirect("/pageNotFound");
  }
};

module.exports = {
  productDetails,
};















