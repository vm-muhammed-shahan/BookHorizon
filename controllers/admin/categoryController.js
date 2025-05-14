const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");

const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const search = req.query.search || '';
    const query = search ? { name: { $regex: search, $options: "i" } } : {};

    const categoryData = await Category.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments(query);
    const totalPages = Math.ceil(totalCategories / limit);

    res.render("category", {
      cat: categoryData,
      currentPage: page,
      totalPages,
      totalCategories,
      search,
      limit
    });

  } catch (error) {
    console.error(error);
    res.redirect("/pageerror");
  }
};



const addCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const existingCategory = await Category.findOne({ name: { $regex: new RegExp('^' + name + '$', 'i') } });

    if (existingCategory) {
      return res.status(400).json({ error: "Category already exists" });
    }

    const newCategory = new Category({ name, description });
    await newCategory.save();

    res.json({ message: "Category added successfully" });

  } catch (error) {
    // console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


const addCategoryOffer = async (req, res) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const categoryId = req.body.categoryId;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }

    const products = await Product.find({ category: category._id });

    const hasProductOffer = products.some(product => product.productOffer > percentage);
    if (hasProductOffer) {
      return res.json({
        status: false,
        message: "Product in this category has higher product offers",
      });
    }

    await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } });

    for (const product of products) {
      product.productOffer = 0;
      product.salePrice = product.regularPrice - Math.floor(product.regularPrice * (percentage / 100));
      await product.save();
    }

    res.json({ status: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};


const removeCategoryOffer = async (req, res) => {
  try {
    const categoryId = req.body.categoryId;
    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }

    const percentage = category.categoryOffer;
    const products = await Product.find({ category: category._id });

    for (const product of products) {
      product.salePrice = product.regularPrice;
      product.productOffer = 0;
      await product.save();
    }

    category.categoryOffer = 0;
    await category.save();

    res.json({ status: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};


const getListCategory = async (req, res) => {
  try {
    let id = req.body.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    res.json({ success: true, newStatus: "Unlisted", badgeClass: "alert-danger" });
  } catch (error) {
    res.json({ success: false });
  }
};


const getUnlistCategory = async (req, res) => {
  try {
    let id = req.body.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: false } });
    res.json({ success: true, newStatus: "Listed", badgeClass: "alert-success" });
  } catch (error) {
    res.json({ success: false });
  }
};


const getEditCategory = async (req, res) => {
  try {
    const id = req.query.id;
    const category = await Category.findById(id);
    res.render("edit-category", { category });
  } catch (error) {
    console.error(error);
    res.redirect("/pageerror");
  }
};


const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { categoryName, description } = req.body;
    const duplicate = await Category.findOne({
      name: { $regex: `^${categoryName}$`, $options: 'i' },
      _id: { $ne: id }
    });
    if (duplicate) {
      return res.status(400).json({ error: "Category name already in use" });
    }
    const updated = await Category.findByIdAndUpdate(
      id,
      { name: categoryName, description },
      { new: true }
    );
    if (updated) {
      res.redirect("/admin/category");
    } else {
      res.status(404).json({ error: "Category not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};







module.exports = {
  categoryInfo,
  addCategory,
  addCategoryOffer,
  removeCategoryOffer,
  getListCategory,
  getUnlistCategory,
  getEditCategory,
  editCategory,

};
