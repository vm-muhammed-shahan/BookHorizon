const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Offer = require('../../models/offerSchema');
const fs = require("fs");
const path = require("path");
// const { session } = require("passport");
const { getRandomNumber } = require("../../helpers/multer");




const getProductAddPage = async (req, res) => {
  try {

    const category = await Category.find({ isListed: true });

    res.render("product-add", { cat: category });

  } catch (error) {

    res.redirect("/pageerror")

  }
};


const addProducts = async (req, res) => {
  try {
    const {
      productName,
      description,
      category,
      regularPrice,
      quantity,
    } = req.body;

    // 1) All fields required
    if (!productName || !description || !category || !regularPrice || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled",
      });
    }

    // 2) Product Name: alphabets & spaces only, length 2–75
    if (!/^[A-Za-z\s]+$/.test(productName.trim())) {
      return res.status(400).json({
        success: false,
        message: "Product name should contain alphabets and spaces only",
      });
    }
    if (productName.trim().length < 2 || productName.trim().length > 75) {
      return res.status(400).json({
        success: false,
        message: "Product name length must be between 2 and 75 characters",
      });
    }

    // 3) Description: alphabets & spaces only, max 1000 chars
    if (!/^[A-Za-z\s]+$/.test(description.trim())) {
      return res.status(400).json({
        success: false,
        message: "Description should contain alphabets and spaces only",
      });
    }
    if (description.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Description cannot exceed 1000 characters",
      });
    }

    // 4) Regular price: must be > 0
    const regPrice = parseFloat(regularPrice);
    if (isNaN(regPrice) || regPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Regular price must be a positive number greater than zero",
      });
    }

    // 5) Quantity: must be >= 0
    const productQty = parseInt(quantity);
    if (isNaN(productQty) || productQty < 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a number greater than or equal to zero",
      });
    }

    // Check images (must be exactly 3)
    if (!req.files || req.files.length !== 3) {
      return res.status(400).json({
        success: false,
        message: "Exactly 3 product images are required",
      });
    }

    // Check for duplicate product name
    const productExist = await Product.findOne({ productName: productName.trim() });
    if (productExist) {
      return res.status(400).json({
        success: false,
        message: "Product already exists, please try with another name",
      });
    }

    // Validate category exists
    const categoryId = await Category.findOne({ _id: category });
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    // Save images
    const images = [];
    const imageDir = path.join(__dirname, '../../public/uploads');
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }
    for (let i = 0; i < req.files.length; i++) {
      images.push(req.files[i].filename);
    }

    // Create product
    const newProduct = new Product({
      productName: productName.trim(),
      description: description.trim(),
      category: categoryId._id,
      regularPrice: regPrice,
      quantity: productQty,
      productImage: images,
      status: 'Available',
    });

    // Apply best offer for sale price
    const { discountedPrice } = await applyBestOffer(newProduct, null, categoryId._id);
    newProduct.salePrice = discountedPrice;

    await newProduct.save();
    return res.status(200).json({ success: true, message: "Product added successfully" });

  } catch (error) {
    console.error("Error saving product", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while adding the product",
    });
  }
};



const getAllProducts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const search = req.query.search || '';
  const skip = (page - 1) * limit;

  try {
    const query = {
      $or: [
        { productName: { $regex: search, $options: 'i' } },
      ],
    };

    const totalProducts = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category')
      .skip(skip)
      .limit(limit);

    const offers = await Offer.find({
      offerType: { $in: ['product', 'category'] },
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });

    for (const product of products) {
      const { discountedPrice } = await applyBestOffer(product, offers);
      if (product.salePrice !== discountedPrice) {
        product.salePrice = discountedPrice;
        await product.save();
      }
    }

    res.render('products', {
      data: products,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      search,
      offers,
    });
  } catch (error) {
    console.error(error);
    res.redirect('/admin/pageerror');
  }
};


const addProductOffer = async (req, res) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const productId = req.body.productId;
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);

    if (startDate < new Date().setHours(0, 0, 0, 0)) {
      return res.status(400).json({
        status: false,
        message: "Start date cannot be in the past",
      });
    }

    if (endDate <= startDate) {
      return res.status(400).json({
        status: false,
        message: "End date must be after start date",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }

    const existingOffer = await Offer.findOne({
      offerType: 'product',
      applicableId: productId,
      isActive: true,
    });
    if (existingOffer) {
      return res.status(400).json({
        status: false,
        message: "An active offer already exists for this product",
      });
    }

    const category = await Category.findById(product.category);
    const categoryOffer = await Offer.findOne({
      offerType: 'category',
      applicableId: product.category,
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });

    if (categoryOffer && categoryOffer.discountPercentage > percentage) {
      return res.json({
        status: false,
        message: "Category offer is higher than the product offer",
      });
    }

    const offer = new Offer({
      offerType: 'product',
      name: `Product Offer for ${product.productName}`,
      discountPercentage: percentage,
      applicableId: productId,
      offerTypeModel: 'Product',
      startDate: startDate,
      endDate: endDate,
      isActive: true,
    });
    await offer.save();

    const offers = await Offer.find({
      offerType: { $in: ['product', 'category'] },
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });
    const { discountedPrice } = await applyBestOffer(product, offers);
    product.salePrice = discountedPrice;
    product.productOffer = percentage;
    await product.save();

    res.json({ status: true, message: "Product offer added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Failed to add product offer" });
  }
};

const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }

    await Offer.deleteOne({ offerType: 'product', applicableId: productId });

    const offers = await Offer.find({
      offerType: { $in: ['product', 'category'] },
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });
    const { discountedPrice } = await applyBestOffer(product, offers);
    product.salePrice = discountedPrice;
    product.productOffer = 0;
    await product.save();

    res.json({ status: true, message: "Product offer removed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Failed to remove product offer" });
  }
};


const blockProduct = async (req, res) => {
  try {
    let id = req.params.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });

    res.json({
      success: true,
      title: 'Product Blocked',
      text: 'The product has been successfully blocked.'
    });
  } catch (error) {
    console.log(error)
    res.status(500).json({
      success: false,
      title: 'Error',
      text: 'Failed to block the product. Please try again.'
    });
  }
};



const unblockProduct = async (req, res) => {
  try {
    let id = req.params.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.json({
      success: true,
      title: 'Product Unblocked',
      text: 'The product has been successfully unblocked.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      title: 'Error',
      text: 'Failed to unblock the product. Please try again.'
    });
  }
};


const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findOne({ _id: id });
    
    
    if (!product) {
      console.error("Product not found with ID:", id);
      return res.redirect("/pageerror");
    }
    
    const category = await Category.find({});
    
    
    if (!product.productImage) {
      product.productImage = [];
    }
    
    res.render("edit-product", {
      product: product,
      cat: category
    });
  } catch (error) {
    console.error("Error in getEditProduct:", error);
    res.redirect("/pageerror");
  }
};


const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findOne({ _id: id });
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    const data = req.body;
    
    // 🔒 Validation rules
    if (!data.productName || !data.description || !data.category || data.regularPrice === undefined || data.quantity === undefined) {
      return res.status(400).json({ error: "All required fields must be filled" });
    }

    // Product name: alphabets only, 2–75 chars
    if (!/^[A-Za-z\s]+$/.test(data.productName)) {
      return res.status(400).json({ error: "Product name should contain alphabets and spaces only" });
    }
    if (data.productName.trim().length < 2 || data.productName.trim().length > 75) {
      return res.status(400).json({ error: "Product name length must be between 2 and 75 characters" });
    }

    // Description: alphabets only, max 1000 chars
    if (!/^[A-Za-z\s]+$/.test(data.description)) {
      return res.status(400).json({ error: "Description should contain alphabets and spaces only" });
    }
    if (data.description.length > 1000) {
      return res.status(400).json({ error: "Description cannot exceed 1000 characters" });
    }

    // Regular price > 0
    const regPrice = parseFloat(data.regularPrice);
    if (isNaN(regPrice) || regPrice <= 0) {
      return res.status(400).json({ error: "Regular price must be greater than zero" });
    }

    // Quantity ≥ 0
    const qty = parseInt(data.quantity);
    if (isNaN(qty) || qty < 0) {
      return res.status(400).json({ error: "Quantity must be zero or a positive number" });
    }

    const existingProduct = await Product.findOne({
      productName: data.productName,
      _id: { $ne: id }
    });
    
    if (existingProduct) {
      return res.status(400).json({ 
        error: "Product with this name already exists. Please try with another name" 
      });
    }
   
    let finalImages = [];
    
    if (data.existingImages) {
      for (const index in data.existingImages) {
        const imageName = data.existingImages[index];
        if (imageName && imageName.trim() !== '') {
          finalImages[parseInt(index)] = imageName;
        }
      }
    }
    
    if (req.files) {
      for (let i = 0; i < 3; i++) {
        const fieldName = `images[${i}]`;
        if (req.files[fieldName] && req.files[fieldName].length > 0) {
          const file = req.files[fieldName][0];
          
          if (finalImages[i]) {
            const oldImagePath = path.join(__dirname, '../../public/uploads/', finalImages[i]);
            if (fs.existsSync(oldImagePath)) {
              try {
                fs.unlinkSync(oldImagePath);
                console.log(`Deleted old image: ${finalImages[i]}`);
              } catch (err) {
                console.error(`Error deleting old image: ${err}`);
              }
            }
          }
          finalImages[i] = file.filename;
        }
      }
    }
   
    if (data.croppedImages) {
      for (const index in data.croppedImages) {
        const imageData = data.croppedImages[index];
        if (imageData && imageData.trim() !== '' && imageData.startsWith('data:image')) {
          const i = parseInt(index);
          const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');
          const filename = `${Date.now()}_${getRandomNumber(0, 10)}_cropped.jpeg`;
          const filePath = path.join(__dirname, '../../public/uploads/', filename);
          
          if (finalImages[i]) {
            const oldImagePath = path.join(__dirname, '../../public/uploads/', finalImages[i]);
            if (fs.existsSync(oldImagePath)) {
              try {
                fs.unlinkSync(oldImagePath);
                console.log(`Deleted old image: ${finalImages[i]}`);
              } catch (err) {
                console.error(`Error deleting old image: ${err}`);
              }
            }
          }
          fs.writeFileSync(filePath, buffer);
          finalImages[i] = filename;
        }
      }
    }
    
    finalImages = finalImages.filter(img => img !== undefined);
    
    if (finalImages.length < 3) {
      return res.status(400).json({ error: "Product must have exactly 3 images" });
    }
    
    product.productName = data.productName;
    product.description = data.description;
    product.category = data.category;
    product.regularPrice = parseFloat(data.regularPrice);
    product.quantity = parseInt(data.quantity);
    product.productImage = finalImages;

    const offers = await Offer.find({
      offerType: { $in: ['product', 'category'] },
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });
    const { discountedPrice } = await applyBestOffer(product, offers);
    product.salePrice = discountedPrice;
    
    await product.save();
    return res.status(200).json({ 
      success: true, 
      message: "Product updated successfully" 
    });
  } catch (error) {
    console.error("Error in editProduct:", error);
    return res.status(500).json({ 
      error: "An error occurred while updating the product" 
    });
  }
};


const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;
    const product = await Product.findByIdAndUpdate(productIdToServer, 
      { $pull: { productImage: imageNameToServer } });
    
    const imagePath = path.join("public", "uploads", "product-images", imageNameToServer);
    if (fs.existsSync(imagePath)) {
      await fs.unlinkSync(imagePath);
    } else {
    }
    
    res.send({ status: true });
  } catch (error) {
    console.error("Error in deleteSingleImage:", error);
    res.status(500).json({ error: "An error occurred while deleting the image" });
  }
}


const applyBestOffer = async (product, offers, categoryId) => {
  try {
    const catId = categoryId || (product.category && product.category._id ? product.category._id.toString() : null);

    const productOffers = offers ? offers.filter(
      offer => offer.offerType === 'product' && 
      offer.applicableId.toString() === product._id.toString() &&
      offer.isActive &&
      offer.startDate <= new Date() &&
      offer.endDate >= new Date()
    ) : [];

    const categoryOffers = offers ? offers.filter(
      offer => offer.offerType === 'category' && 
      offer.applicableId.toString() === catId &&
      offer.isActive &&
      offer.startDate <= new Date() &&
      offer.endDate >= new Date()
    ) : [];

    let bestDiscount = 0;
    let bestOfferType = null;
    if (productOffers.length > 0 || categoryOffers.length > 0) {
      const allOffers = [...productOffers, ...categoryOffers];
      const maxDiscount = Math.max(...allOffers.map(o => o.discountPercentage), 0);
      bestDiscount = maxDiscount;
      bestOfferType = allOffers.find(o => o.discountPercentage === maxDiscount).offerType;
    }

    const discountedPrice = product.regularPrice * (1 - bestDiscount / 100);
    return { discountedPrice, bestDiscount, bestOfferType };
  } catch (error) {
    console.error("Error applying best offer:", error);
    return { discountedPrice: product.regularPrice, bestDiscount: 0, bestOfferType: null };
  }
};



module.exports = {
  getProductAddPage,
  addProducts,
  getAllProducts,
  addProductOffer,
  removeProductOffer,
  blockProduct,
  unblockProduct,
  getEditProduct,
  editProduct,
  deleteSingleImage,
  applyBestOffer,
};