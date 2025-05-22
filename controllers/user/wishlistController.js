const Wishlist = require('../../models/wishlistSchema');
const Cart = require("../../models/cartSchema");
const Product = require('../models/productSchema');

exports.addToWishlist = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const productId = req.query.id;
  const userId = req.session.user._id;

  try {
    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) wishlist = new Wishlist({ userId, items: [] });

    const exists = wishlist.items.some(item => item.toString() === productId);
    if (!exists) {
      wishlist.items.push(productId);
      await wishlist.save();
    }

    res.redirect('/wishlist');
  } catch (err) {
    console.error(err);
    res.redirect('back');
  }
};

exports.getWishlist = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  try {
    const wishlist = await Wishlist.findOne({ userId: req.session.user._id }).populate('items');
    res.render('wishlist', { products: wishlist ? wishlist.items : [] });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
};
