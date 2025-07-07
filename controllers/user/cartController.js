const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");



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
      return res.status(404).json({ error: "Cart not found" });
    }
    const item = cart.items.find(i => i.productId._id.toString() === productId);
    if (!item) {
      return res.status(404).json({ error: "Item not found in cart" });
    }
    const currentStock = parseInt(item.productId.quantity) || 0;
    const maxQuantity = Math.min(5, currentStock);
    if (action === "increment") {
      if (item.quantity >= maxQuantity) {
        const errorMessage = currentStock <= 5
          ? `Only ${currentStock} items available in stock`
          : "Maximum quantity of 5 reached";
        return res.status(400).json({ error: errorMessage });
      }
      item.quantity++;
    } else if (action === "decrement") {
      if (item.quantity <= 1) {
        return res.status(400).json({ error: "Minimum quantity of 1 reached" });
      }
      item.quantity--;
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }
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
    res.status(500).json({ error: "Internal server error" });
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
    const cart = await Cart.findOne({ userId: req.session.user._id })
      .populate('items.productId', 'productName regularPrice salePrice productImage quantity status isBlocked');

    let items = cart?.items || [];
    let removedItems = [];

    // Filter out unlisted/blocked products and collect them for removal
    const validItems = [];
    const itemsToRemove = [];

    for (const item of items) {
      if (item.productId && !item.productId.isBlocked && item.productId.status === 'Available') {
        validItems.push(item);
      } else {
        itemsToRemove.push(item.productId._id);
        removedItems.push(item.productId?.productName || 'Unknown Product');
      }
    }

    // Remove unlisted/blocked items from the cart in database
    if (itemsToRemove.length > 0) {
      await Cart.updateOne(
        { userId: req.session.user._id },
        { $pull: { items: { productId: { $in: itemsToRemove } } } }
      );
    }

    // Set a message if items were removed
    let message = null;
    if (removedItems.length > 0) {
      message = `${removedItems.length} item(s) were removed from your cart as they are no longer available: ${removedItems.join(', ')}`;
    }

    res.render('cart', { 
      items: validItems, 
      user: req.session.user,
      message: message
    });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
};

// Helper function to clean cart items (can be called from other parts of the app)
const cleanCartItems = async (userId) => {
  try {
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart) return;

    const itemsToRemove = [];
    for (const item of cart.items) {
      if (!item.productId || item.productId.isBlocked || item.productId.status !== 'Available') {
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

module.exports = {
  addToCart,
  updateQuantity,
  removeItem,
  removeItemPost,
  viewCart,
  cleanCartItems
};