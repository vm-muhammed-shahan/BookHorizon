const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const { session } = require("passport");
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
      salePrice,
      quantity,
      } = req.body;
      if(!productName || !description || !category || !regularPrice || !salePrice || !quantity) {
        return res.status(400).json({
          success: false,
        message: "All required fields must be filled"
        });
      }
      if(!req.files || req.files.length !== 3) {
      return res.status(400).json({
        success: false,
        message: "Exactly 3 product images are required"
      });
    }
    const regPrice = parseFloat(regularPrice);
    const discPrice = salePrice ? parseFloat(salePrice) : 0;
    if (isNaN(regPrice) || regPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Regular price must be a positive number greater than zero"
      });
    }
    if (salePrice && (isNaN(discPrice) || discPrice <= 0)) {
      return res.status(400).json({
        success: false,
        message: "Sale price must be a positive number greater than zero"
      });
    }
    if (discPrice && discPrice >= regPrice) {
      return res.status(400).json({
        success: false,
        message: "Sale price must be less than regular price"
      });
    }
     const productQty = parseInt(quantity);
    if (isNaN(productQty) || productQty <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive number greater than zero"
      });
    }
    const productExist = await Product.findOne({
      productName: productName
    });
if (productExist) {
      return res.status(400).json({
        success: false,
        message: "Product already exists, please try with another name"
      });
    }
    const categoryId = await Category.findOne({ name: category });
    if(!categoryId) {
      return res.status(400).json({
        success: false,
        message: "Invalid category name"
      });
    }
    const images = [];
    const imageDir = path.join(__dirname, '../../public/uploads');
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const originalImagePath = req.files[i].path;
        const resizedImagePath = path.join(imageDir, req.files[i].filename);
        images.push(req.files[i].filename);
      }
    }
    const newProduct = new Product({
      productName,
      description,
      category: categoryId._id,
      regularPrice: regPrice,
      salePrice: discPrice || undefined,
      createdOn: new Date(),
      quantity: productQty,
      productImage: images,
      status: 'Available',
    });
    await newProduct.save();
    return res.status(200).json({success: true, message: "Product added successfully"}); 
  } catch (error) {
    console.error("Error saving product", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while adding the product"
    });
  }
}




const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const productData = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('category')
      .exec();
    console.log(productData.map(p => ({ 
      name: p.productName, 
      createdAt: p.createdAt,
      dateFormatted: p.createdAt ? new Date(p.createdAt).toISOString() : 'undefined' 
    })));
    const count = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    }).countDocuments();
    const category = await Category.find({ isListed: true });
    if (category) {
      res.render("products", {
        data: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        cat: category,
        session: req.session
      });
    } else {
      res.render("page-404");
    }
  } catch (error) {
    console.error("Error in getAllProducts:", error);
    res.redirect("/pageerror");
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
    console.log("Received data:", data);
    console.log("Received files:", req.files);
    
    
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
    product.regularPrice = data.regularPrice;
    product.salePrice = data.salePrice;
    product.quantity = data.quantity;
    product.productImage = finalImages;
    
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
      console.log(`Image ${imageNameToServer} deleted successfully`);
    } else {
      console.log(`Image ${imageNameToServer} not found`);
    }
    
    res.send({ status: true });
  } catch (error) {
    console.error("Error in deleteSingleImage:", error);
    res.status(500).json({ error: "An error occurred while deleting the image" });
  }
}





module.exports = {
  getProductAddPage,
  addProducts,
  getAllProducts,
  blockProduct,
  unblockProduct,
  getEditProduct,
  editProduct,
  deleteSingleImage,
};
