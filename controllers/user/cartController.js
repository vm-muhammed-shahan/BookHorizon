const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");


const addToCart = async (req, res) => {
  try {
    const userId = req.session.user._id || req.session.user;
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
      message: `${product.productName}  has been added to your cart.`,
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
    console.log("Product ID:", productId);
    console.log("Product Details:", item.productId);
    console.log("Current Stock:", item.productId.stock);
    console.log("Current Quantity:", item.quantity);
    const currentStock = parseInt(item.productId.quantity) || 0;
    const maxQuantity = Math.min(5, currentStock);
    console.log("Calculated Max Quantity:", maxQuantity);
    if (action === "increment") {
      if (item.quantity >= maxQuantity) {
        const errorMessage = currentStock <= 5
          ? `Only ${currentStock} items available in stock`
          : "Maximum quantity of 5 reached";
        console.log("Increment blocked:", errorMessage);
        return res.status(400).json({ error: errorMessage });
      }
      item.quantity++;
      console.log("Quantity incremented to:", item.quantity);

    } else if (action === "decrement") {
      if (item.quantity <= 1) {
        console.log("Decrement blocked: Minimum quantity is 1");
        return res.status(400).json({ error: "Minimum quantity is 1" });
      }
      item.quantity--;
      console.log("Quantity decremented to:", item.quantity);
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }
    item.totalPrice = item.quantity * item.price;
    await cart.save();
    res.redirect("/cart");
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



const viewCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.session.user._id })
      .populate('items.productId', 'productName regularPrice salePrice productImage quantity status');

    const items = cart?.items || [];


    res.render('cart', { items, user: req.session.user });

  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
};




module.exports = {
  addToCart,
  updateQuantity,
  removeItem,
  viewCart,
}