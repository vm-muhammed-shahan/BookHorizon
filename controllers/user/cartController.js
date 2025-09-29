const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");
const User = require("../../models/userSchema");
const cleanCartItems = async (userId) => {
  try {
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: { path: "category", select: "isListed" }
    });
    if (!cart) return;
    const itemsToRemove = [];
    for (const item of cart.items) {
      if (
        !item.productId ||
        item.productId.isBlocked ||
        item.productId.status !== 'Available' ||
        (item.productId.category && item.productId.category.isListed === false)
      ) {
        itemsToRemove.push(item.productId._id);
      }
    }
    if (itemsToRemove.length > 0) {
      await Cart.updateOne(
        { userId },
        { $pull: { items: { productId: { $in: itemsToRemove } } } }
      );
    }
  } catch (error) {
    console.error('Error cleaning cart items:', error);
  }
};







const addToCart = async (req, res) => {
  try {
    const userId = req.session.user._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'You need to be logged in to add items to cart.'
      });
    }
    const { productId, quantity } = req.body;
    const product = await Product.findById(productId);
    if (!product || product.isBlocked || product.status !== 'Available') {
      return res.status(400).json({
        success: false,
        message: 'Product is out of stock or unavailable.'
      });
    }
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }
    const item = cart.items.find(i => i.productId.toString() === productId);
    if (item) {
      return res.status(400).json({
        success: false,
        message: 'This product is already in your cart.'
      });
    }
    if (product.quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Product is out of stock.'
      });
    }
    cart.items.push({
      productId,
      quantity: 1,
      price: product.salePrice,
      totalPrice: Number(product.salePrice)
    });
    await cart.save();
    await Wishlist.findOneAndUpdate(
      { userId },
      { $pull: { products: { productId: productId } } }
    );
    res.status(200).json({
      success: true,
      message: `${product.productName} has been added to your cart.`,
      productName: product.productName
    });
  } catch (error) {
    console.log('Error adding to cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add item to cart. Please try again.'
    });
  }
};


const updateQuantity = async (req, res) => {
  try {
    const { productId, action } = req.body;
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) {
      return res.status(404).json({ success: false, error: "Cart not found" });
    }
    const item = cart.items.find(i => i.productId._id.toString() === productId);
    if (!item) {
      return res.status(404).json({ success: false, error: "Item not found in cart" });
    }
    const currentStock = parseInt(item.productId.quantity) || 0;
    const maxQuantity = Math.min(5, currentStock);
    let newQuantity = item.quantity;

    if (action === "increment") {
      if (item.quantity >= maxQuantity) {
        return res.status(400).json({ success: false, error: currentStock <= 5 ? `Only ${currentStock} items available in stock` : "Maximum quantity of 5 reached" });
      }
      newQuantity++;
    } else if (action === "decrement") {
      if (item.quantity <= 1) {
        return res.status(400).json({ success: false, error: "Minimum quantity of 1 reached" });
      }
      newQuantity--;
    } else {
      return res.status(400).json({ success: false, error: "Invalid action" });
    }

    item.quantity = newQuantity;
    item.totalPrice = item.quantity * item.price;
    await cart.save();

    res.status(200).json({
      success: true,
      quantity: item.quantity,
      subtotal: item.totalPrice,
      message: "Quantity updated successfully"
    });
  } catch (error) {
    console.error("Error updating cart quantity:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};


const removeItem = async (req, res) => {
  const { productId } = req.params;
  const userId = req.session.user._id;

  await Cart.updateOne(
    { userId },
    { $pull: { items: { productId } } }
  );

  res.redirect("/cart");
};


const removeItemPost = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.session.user._id;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found.' });
    }

    const itemExists = cart.items.some(item => item.productId.toString() === productId);
    if (!itemExists) {
      return res.status(404).json({ success: false, message: 'Item not found in cart.' });
    }

    await Cart.updateOne(
      { userId },
      { $pull: { items: { productId } } }
    );

    res.status(200).json({ success: true, message: 'Item removed from cart.' });
  } catch (error) {
    console.error('Error removing item from cart:', error);
    res.status(500).json({ success: false, message: 'Failed to remove item from cart.' });
  }
};


const viewCart = async (req, res) => {
  try {
    const userId = req.session.user._id;
    if (!userId) {
      return res.redirect('/login');
    }
    await cleanCartItems(userId);
    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: "category", select: "isBlocked" },
      select: 'productName regularPrice salePrice productImage quantity status isBlocked category'
    });
    let items = cart?.items || [];
    for (const item of items) {
      if (
        item.productId &&
        !item.productId.isBlocked &&
        item.productId.status === 'Available' &&
        !(item.productId.category && item.productId.category.isListed ===  false)
      ) {
        const product = await Product.findById(item.productId._id).select('salePrice quantity');
        if (product) {
          item.price = product.salePrice;

          if (item.quantity > product.quantity) {
            item.quantity = product.quantity;
          }

          item.totalPrice = item.quantity * product.salePrice;
          item.productId.quantity = product.quantity;
        }
      }
    }
    if (cart) {
      await cart.save();
    }
    // filter only valid items
    const validItems = [];
    for (const item of items) {
      if (
        item.productId &&
        !item.productId.isBlocked &&
        item.productId.status === "Available" &&
        !(item.productId.category && item.productId.category.isBlocked)
      ) {
        validItems.push({
          ...item.toObject(),
          isOutOfStock: item.productId.quantity === 0
        });
      }
    }
    const userData = await User.findOne({ _id: userId }).select('name email');
    if (!userData) {
      console.warn(`User not found for userId: ${userId}`);
      return res.redirect('/');
    }
    res.render('cart', {
      items: validItems,
      user: userData,
      hasValidItems: validItems.length > 0
    });
  } catch (err) {
    console.error('Error in viewCart:', err);
    req.session.message = { type: 'error', text: 'An error occurred while loading your cart. Please try again.' };
    res.redirect('/cart');
  }
};



  module.exports = {
    addToCart,
    updateQuantity,
    removeItem,
    removeItemPost,
    viewCart,
    cleanCartItems
  };