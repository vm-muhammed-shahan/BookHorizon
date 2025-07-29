const Wishlist = require('../../models/wishlistSchema');
const Cart = require("../../models/cartSchema");
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema')



const getwishlist = async (req, res) => {
  if (!req.session.user) {
    console.log('No user session, redirecting to login');
    return res.redirect('/login');
  }

  try {
    const userData = req.session.user ? await User.findById(req.session.user._id) : null;
    const wishlist = await Wishlist.findOne({ userId: req.session.user._id }).populate('products.productId');
    console.log('Wishlist fetched:', JSON.stringify(wishlist, null, 2)); 
    res.render('wishlist', {
      user: userData,
      products: wishlist ? wishlist.products : []
    });
  } catch (err) {
    console.error('Error fetching wishlist:', err);
    res.redirect('/');
  }
};

const addToWishlist = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { productId } = req.body;
    console.log(productId);
    const product = await Product.findById(productId).select('isBlocked quantity');
    if (!product || product.isBlocked) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unavailable'
      });
    }
    const cart = await Cart.findOne({ userId }).select('items.productId');
    if (
      cart &&
      cart.items.some((item) => item.productId.toString() === productId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add to wishlist - product is already in your cart'
      });
    }
    const wishlist = await Wishlist.findOne({ userId });
    if (
      wishlist &&
      wishlist.products.some((item) => item.productId.toString() === productId)
    ) {
      // Instead of returning success, we'll let the client decide to remove it
      return res.status(400).json({
        success: false,
        message: 'Product is already in your wishlist'
      });
    }
    await Wishlist.findOneAndUpdate(
      { userId },
      { $addToSet: { products: { productId } } },
      { upsert: true, new: true }
    );
    res.status(200).json({
      success: true,
      message: 'Product added to wishlist successfully',
      wishlistCount: wishlist ? wishlist.products.length + 1 : 1
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add to wishlist. Please try again.'
    });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { productId } = req.body;
    await Wishlist.findOneAndUpdate(
      { userId },
      { $pull: { products: { productId } } }
    );
    return res.json({ success: true, productId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Could not remove item.' });
  }
};

const moveToCart = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { productId } = req.body;
    const product = await Product.findById(productId).select('salePrice regularPrice quantity productName');
    const price = product.salePrice || product.regularPrice;
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    if (product.quantity < 1) {
      return res.status(400).json({ success: false, message: 'Out of stock.' });
    }
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existing = cart.items.find(i => i.productId.toString() === productId);
    if (existing) {
      if (existing.quantity >= product.quantity) {
        return res.status(400).json({ success: false, message: 'Stock limit reached' });
      }
      existing.quantity += 1;
      existing.totalPrice = existing.quantity * existing.price;
    } else {
      cart.items.push({
        productId,
        quantity: 1,
        price: price,
        totalPrice: price,
        stock: product.quantity
      });
    }

    await cart.save();

    await Wishlist.findOneAndUpdate(
      { userId },
      { $pull: { products: { productId } } }
    );

    return res.json({ success: true, message: `"${product.productName}" has been moved to your cart.` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Could not move to cart.' });
  }
};

const clearWishlist = async (req, res) => {
  try {
    const userId = req.session.user._id;
    await Wishlist.findOneAndUpdate(
      { userId },
      { $set: { products: [] } }
    );
    res.json({ success: true, message: 'Your wishlist has been cleared successfully.' });
  } catch (error) {
    console.error("Error clearing wishlist:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear wishlist. Please try again."
    });
  }
};


const toggleWishlist = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { productId, action } = req.body;

    const product = await Product.findById(productId).select('isBlocked quantity');
    if (!product || product.isBlocked) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unavailable'
      });
    }

    const cart = await Cart.findOne({ userId }).select('items.productId');
    if (action === 'add' && cart && cart.items.some((item) => item.productId.toString() === productId)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add to wishlist - product is already in your cart'
      });
    }

    let wishlist = await Wishlist.findOne({ userId });

    if (action === 'add') {
      if (wishlist && wishlist.products.some((item) => item.productId.toString() === productId)) {
        return res.status(200).json({
          success: true,
          message: 'Product is already in your wishlist'
        });
      }
      await Wishlist.findOneAndUpdate(
        { userId },
        { $addToSet: { products: { productId } } },
        { upsert: true, new: true }
      );
      return res.status(200).json({
        success: true,
        message: 'Product added to wishlist successfully'
      });
    } else if (action === 'remove') {
      if (!wishlist || !wishlist.products.some((item) => item.productId.toString() === productId)) {
        return res.status(200).json({
          success: true,
          message: 'Product not in wishlist'
        });
      }
      await Wishlist.findOneAndUpdate(
        { userId },
        { $pull: { products: { productId } } }
      );
      return res.status(200).json({
        success: true,
        message: 'Product removed from wishlist successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action specified'
      });
    }
  } catch (error) {
    console.error('Error toggling wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update wishlist. Please try again.'
    });
  }
};


module.exports = {
  addToWishlist,
  getwishlist,
  removeFromWishlist,
  toggleWishlist,
  moveToCart,
  clearWishlist,
};