const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const { session } = require("passport");


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
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });

    req.session.blockUnblockMessage = {
      type: 'success',
      title: 'Product Blocked',
      text: 'The product has been successfully blocked.'
    };

    res.redirect("/admin/products");
  } catch (error) {
    // Set an error message in session flash data
    req.session.blockUnblockMessage = {
      type: 'error',
      title: 'Error',
      text: 'Failed to block the product. Please try again.'
    };
    res.redirect("/admin/products");
  }
};


const unblockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    
    // Set a success message in session flash data
    req.session.blockUnblockMessage = {
      type: 'success',
      title: 'Product Unblocked',
      text: 'The product has been successfully unblocked.'
    };
    
    res.redirect("/admin/products");
  } catch (error) {
    // Set an error message in session flash data
    req.session.blockUnblockMessage = {
      type: 'error',
      title: 'Error',
      text: 'Failed to unblock the product. Please try again.'
    };
    res.redirect("/admin/products");
  }
};


const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findOne({ _id: id });
    const category = await Category.find({});
    res.render("edit-product", {
      product: product,
      cat: category,
      productImage: product.productImage
    })
  } catch (error) {
    res.redirect("/pageerror");

  }
};


const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findOne({ _id: id });
    const data = req.body;
    const existingProduct = await Product.findOne({
      productName: data.productName,
      _id: { $ne: id }
    })
    if (existingProduct) {
      return res.status(400).json({ error: "product with this name  already exists. Please try with another name" });
    }
    const images = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        images.push(req.files[i].filename);
      }
    }
    if (req.files && req.files.length > 0 && product.productImage && product.productImage.length > 0) {
      for (const oldImage of product.productImage) {
        const imagePath = path.join(__dirname, '../../public/uploads/product-images/', oldImage);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath); 
        }
      }
    }
const updateFields = {
      productName: data.productName,
      description: data.description,
      category: data.category,
      regularPrice: data.regularPrice,
      salePrice: data.salePrice,
      quantity: data.quantity,
    }
    if (images.length > 0) {
      updateFields.productImage =  images ;
    }

    // await Product.findByIdAndUpdate(id, updateFields, { new: true });

product.productName = data.productName;
product.description = data.description;
product.category = data.category;
product.regularPrice = data.regularPrice;
product.salePrice = data.salePrice;
product.quantity = data.quantity;

if (images.length > 0) {
  product.productImage = images;
}

await product.save(); 
    return res.status(200).json({ success: true, message:"product updated successfully" });
  } catch (error) {
    console.error(error);
    res.redirect("/pageerror");
  }
}



const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;
    const product = await Product.findByIdAndUpdate(productIdToServer, { $pull: { productImage: imageNameToServer } });
    const imagePath = path.join("public", "uploads", "re-image", imageNameToServer);
    if (fs.existsSync(imagePath)) {
      await fs.unlinkSync(imagePath);
      console.log(`Image ${imageNameToServer} delete successfully`);
    } else {
      console.log(`Image ${imageNameToServer} not found`);
    }
    res.send({ status: true });
  } catch (error) {
    res.redirect("/pageerror")
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
