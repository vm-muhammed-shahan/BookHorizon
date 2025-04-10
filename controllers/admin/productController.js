const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");



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
        return res.status(400).json("All fields are required");
      }

      if(!req.files || req.files.length === 0) {
        return res.status(400).json("Product images are required");
      }

    
    const productExist = await Product.findOne({
      productName: productName,
    });

    if (productExist) {
      console.log("Product already exists:", productName);
       return res.status(400).json("Product already exists, please try with another name");
    }

    const categoryId = await Category.findOne({ name: category });

    if(!categoryId) {
      console.log("Invalid category name:", category);
      return res.status(400).json("Invalid category name");
    }

    const images = [];
    const imageDir = path.join(__dirname, '../../public/uploads/product-images');
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
      regularPrice,
      salePrice,
      createdOn: new Date(),
      quantity,
      productImage: images,
      status: 'Available',
    });

    await newProduct.save();
    console.log("Product saved successfully:", newProduct);
    return res.status(200).json({success:true});
    
  } catch (error) {
    console.error("Error saving product", error);
    return res.redirect("/admin/pageerror");
  }
}









const getAllProducts = async (req, res) => {

  console.log("product page called");
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;

    const productData = await Product.find({
      $or: [

        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },

      ],
    })
      .limit(limit).skip((page - 1) * limit).populate('category').exec();
    console.log(productData)

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


      })
    } else {
      res.render("page-404");

    }

  } catch (error) {

    res.redirect("/pageerror");
  }
};


const blockProduct = async (req, res) => {
  try {

    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect("/admin/products");

  } catch (error) {
    res.redirect("/pageerror")

  }
}



const unblockProduct = async (req, res) => {
  try {

    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/products");

  } catch (error) {
    res.redirect("/pageerror")

  }
}





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


    const updateFields = {
      productName: data.productName,
      description: data.description,
      category: product.category,
      regularPrice: data.regularPrice,
      salePrice: data.regularPrice,
      quantity: data.quantity,
    }

    if (req.files.length > 0) {
      updateFields.$push = { productImage: { $each: images } };
    }

    await Product.findByIdAndUpdate(id, updateFields, { new: true });
    return res.status(200).json({ success: true });


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
