const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");

const addToCart = async (req, res) => {
  const userId = req.session.user._id;
  const { productId } = req.body;

  const product = await Product.findById(productId);
  console.log("Product found:", product);

  // 1. Check if product exists and is active
  if (!product || product.isBlocked || product.status !== 'Available' ) {
    return res.status(400).send("Product is not available");
  }

  // 2. Get or create cart
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = new Cart({ userId, items: [] });
  }

  const item = cart.items.find(i => i.productId.toString() === productId);

  if (item) {
    // 3. If already in cart, increase quantity if in stock
    if (item.quantity + 1 > product.stock) {
      return res.status(400).send("Not enough stock");
    }
    item.quantity += 1;
    item.totalPrice = Number(item.quantity) * Number(product. salePrice);
  } else {
    // 4. Add new item
    if (product.stock < 1) {
      return res.status(400).send("Product is out of stock");
    }
    cart.items.push({
      productId,
      quantity: 1,
      price: product.salePrice,
      totalPrice: Number(product.salePrice)
    });
  }

  await cart.save();

  // 5. Remove from wishlist if present
  await Wishlist.updateOne(
    { userId },
    { $pull: { products: productId } }
  );

  res.redirect("/cart");
};




// const updateQuantity = async (req, res) => {
//   try {
//     const { productId, action } = req.body;
//     const userId = req.session.user._id;
//     const cart = await Cart.findOne({ userId }).populate("items.productId");
//     if (!cart) {
//       return res.status(404).json({ error: "Cart not found" });
//     }
//     const item = cart.items.find(i => i.productId._id.toString() === productId);
//     if (!item) {
//       return res.status(404).json({ error: "Item not found in cart" });
//     }
//     const currentStock = item.productId.stock || 0;
//     const maxQuantity = Math.min(5, currentStock);
//     if (action === "increment") {
//       if (item.quantity >= maxQuantity) {
//         const errorMessage = currentStock <= 5 
//           ? `Only ${currentStock} items available in stock`
//           : "Maximum quantity of 5 reached";
//         return res.status(400).json({ error: errorMessage });
//       }
//       item.quantity++;
//     } else if (action === "decrement") {
//       if (item.quantity <= 1) {
//         return res.status(400).json({ error: "Minimum quantity is 1" });
//       }
//       item.quantity--;
//     } else {
//       return res.status(400).json({ error: "Invalid action" });
//     }
//     item.totalPrice = item.quantity * item.price;
//     await cart.save();
//     res.redirect("/cart");
//   } catch (error) {
//     console.error("Error updating cart quantity:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };





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


// const viewCart = async (req, res) => {
//   try {
//     const userId = req.session.user._id;
//     const cart = await Cart.findOne({ userId }).populate("items.productId");
//     if (!cart || cart.items.length === 0) {
//       return res.render("cart", { items: [] });
//     }
//     console.log("Cart Items:", JSON.stringify(cart.items, null, 2));
//     const validItems = cart.items.filter(item => item.productId && item.productId._id);
//     validItems.forEach((item, index) => {
//       console.log(`Item ${index + 1}:`, {
//         name: item.productId.productName,
//         stock: item.productId.stock,
//         quantity: item.quantity,
//         price: item.price
//       });
//     });
    
//     res.render("cart", { items: validItems });
    
//   } catch (error) {
//     console.error("Error viewing cart:", error);
//     res.render("cart", { items: [] });
//   }
// };


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
  const userId = req.session.user._id;
  const cart = await Cart.findOne({ userId }).populate("items.productId");

  const items = (cart?.items || []).filter(item => {
    return item.productId && !item.productId.isBlocked ;
  });
  console.log(items.forEach((product)=>{product.productId}));

  res.render("cart", { items });
};

module.exports={
  addToCart,
  updateQuantity,
  removeItem,
  viewCart,
}