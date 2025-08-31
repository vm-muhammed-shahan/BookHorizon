const Offer = require("../../models/offerSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Coupon = require("../../models/couponSchema");
const User = require("../../models/userSchema");



const getOffersPage = async (req, res) => {
  try {
    const offers = await Offer.find()
      .populate("targetId")
      .lean();
    res.render("admin/offers", { offers });
  } catch (error) {
    console.error("Error loading offers page:", error);
    res.render("admin/offers", { offers: [], error: "Failed to load offers" });
  }
}


const addProductOffer = async (req, res) => {
  try {
    const { productId, percentage, startDate, endDate, name } = req.body;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }
    const offer = new Offer({
      type: "product",
      name,
      discountPercentage: percentage,
      startDate,
      endDate,
      targetId: productId,
      typeModel: "Product",
    });
    await offer.save();
    res.json({ status: true, message: "Product offer added successfully" });
  } catch (error) {
    console.error("Error adding product offer:", error);
    res.status(500).json({ status: false, message: "Failed to add product offer" });
  }
}


const addCategoryOffer = async (req, res) => {
  try {
    const { categoryId, percentage, startDate, endDate, name } = req.body;
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }
    const offer = new Offer({
      type: "category",
      name,
      discountPercentage: percentage,
      startDate,
      endDate,
      targetId: categoryId,
      typeModel: "Category",
    });
    await offer.save();
    res.json({ status: true, message: "Category offer added successfully" });
  } catch (error) {
    console.error("Error adding category offer:", error);
    res.status(500).json({ status: false, message: "Failed to add category offer" });
  }
}


const removeOffer = async (req, res) => {
  try {
    const { offerId } = req.body;
    await Offer.findByIdAndDelete(offerId);
    res.json({ status: true, message: "Offer removed successfully" });
  } catch (error) {
    console.error("Error removing offer:", error);
    res.status(500).json({ status: false, message: "Failed to remove offer" });
  }
}


const createReferralOffer = async (req, res) => {
  try {
    const { name, discountPercentage, startDate, endDate, minimumPrice } = req.body;
    const couponCode = `REF-${Math.random().toString(36).slice(-8).toUpperCase()}`;
    const offer = new Offer({
      type: "referral",
      name,
      discountPercentage,
      startDate,
      endDate,
      couponCode,
      minimumPrice,
    });
    await offer.save();

    // Create a corresponding coupon for referral rewards
    const coupon = new Coupon({
      name: couponCode,
      offerPrice: discountPercentage,
      minimumPrice,
      createdOn: new Date(),
      expireOn: endDate,
      islist: true,
    });
    await coupon.save();

    res.json({ status: true, message: "Referral offer created successfully" });
  } catch (error) {
    console.error("Error creating referral offer:", error);
    res.status(500).json({ status: false, message: "Failed to create referral offer" });
  }
}

const handleReferral = async (req, res) => {
  try {
    const { referralCode, token } = req.query;
    let referrer;

    if (referralCode) {
      referrer = await User.findOne({ referralCode });
    } else if (token) {
      referrer = await User.findOne({ referralCode: token });
    }

    if (!referrer) {
      return res.redirect("/signup?error=Invalid referral code or token");
    }

    // Pass the referrer ID to the signup page
    res.render("signup", { referrerId: referrer._id, message: null });
  } catch (error) {
    console.error("Error handling referral:", error);
    res.redirect("/signup?error=Error processing referral");
  }
}

const rewardReferrer = async (newUser, referrerId) => {
  try {
    const referrer = await User.findById(referrerId);
    if (!referrer) return;

    const activeReferralOffer = await Offer.findOne({
      type: "referral",
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });

    if (activeReferralOffer) {
      // Add the new user to the referrer's redeemedUsers
      referrer.redeemedUsers.push(newUser._id);
      await referrer.save();

      // Assign the referral coupon to the referrer
      const coupon = await Coupon.findOne({ name: activeReferralOffer.couponCode });
      if (coupon) {
        coupon.userId.push(referrer._id);
        await coupon.save();
      }
    }
  } catch (error) {
    console.error("Error rewarding referrer:", error);
  }
}

const removeCategoryOffer = async (req, res) => {
  try {
    const { categoryId } = req.body;
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }

    await Offer.deleteOne({ offerType: 'category', applicableId: categoryId });

    // Update all products in this category
    const products = await Product.find({ category: categoryId });
    for (const product of products) {
      const { discountedPrice } = await applyBestOffer(product);
      product.salePrice = discountedPrice;
      await product.save();
    }

    res.json({ status: true, message: "Category offer removed successfully" });
  } catch (error) {
    console.error("Error removing category offer:", error);
    res.status(500).json({ status: false, message: "Failed to remove category offer" });
  }
};


  module.exports = {
    getOffersPage,
    addProductOffer,
    addCategoryOffer,
    removeOffer,
    createReferralOffer,
    handleReferral,
    rewardReferrer,
   removeCategoryOffer, 
  }
