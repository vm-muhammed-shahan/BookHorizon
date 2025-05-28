const Wishlist = require('../../models/wishlistSchema');
const Cart = require("../../models/cartSchema");
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema')



const getwishlist = async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  try {
    const userData = req.session.user ? await User.findById(req.session.user) : null;
    const wishlist = await Wishlist.findOne({ userId: req.session.user.id }).populate('products.productId');
    res.render('wishlist', { user: userData, products: wishlist ? wishlist.products : [] });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
};





const addToWishlist = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { productId } = req.body
    console.log(productId)
    const product =
      await Product.findById(productId).select('isBlocked quantity');
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
      return res.status(400).json({
        success: true,
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
    const userId = req.session.user.id;
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
}




const moveToCart = async (req, res) => {
  try {
    const userId = req.session.user.id || req.session.user?._id;
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

    // 3️⃣ See if the item’s already in the cart
    const existing = cart.items.find(i => i.productId.toString() === productId);
    if (existing) {
      if (existing.quantity >= product.quantity) {
        return res.status(400).json({ success: false, message: 'Stock limit reached' });
      }
      existing.quantity += 1;
      existing.totalPrice = existing.quantity * existing.price;
    } else {
      // push new item
      cart.items.push({
        productId,
        quantity: 1,
        price: price,
        totalPrice: price,
        stock: product.quantity
        // status and cancellationReason will use their defaults
      });
    }

    // 4️⃣ Persist the cart
    await cart.save();

    // 5️⃣ Remove from wishlist
    await Wishlist.findOneAndUpdate(
      { userId },
      { $pull: { products: { productId } } }
    );

    return res.json({ success: true, message: `"${product.name}" has been moved to your cart.` });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: 'Could not move to cart.' });
  }
}



const clearWishlist = async (req, res) => {
  try {
    const userId = req.session.user._id;
    // clear out products array
    await Wishlist.findOneAndUpdate(
      { userId },
      { $set: { products: [] } }
    );
    // respond with JSON for AJAX
    res.json({ success: true, message: 'Your wishlist has been cleared successfully.' });
  } catch (error) {
    console.error("Error clearing wishlist:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear wishlist. Please try again."
    });
  }
}




module.exports = {
  addToWishlist,
  getwishlist,
  removeFromWishlist,
  moveToCart,
  clearWishlist,
}