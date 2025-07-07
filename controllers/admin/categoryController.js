const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Offer = require("../../models/offerSchema");

const categoryInfo = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 5;
  const search = req.query.search || '';
  const skip = (page - 1) * limit;

  try {
    
    const query = search
      ? { name: { $regex: search, $options: 'i' } }
      : {};

    const totalCategories = await Category.countDocuments(query);
    const categories = await Category.find(query)
      .skip(skip)
      .limit(limit);

    const offers = await Offer.find({ offerType: 'category', isActive: true });
    console.log('Fetched offers:', offers);
    
    res.render('category', {
      cat: categories,
      currentPage: page,
      totalPages: Math.ceil(totalCategories / limit),
      search,
      limit,
      offers,
    });
  } catch (error) {
    console.error(error);
    res.redirect('/admin/pageerror');
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
     console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


const addCategoryOffer = async (req, res) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const categoryId = req.body.categoryId;
    const endDate = new Date(req.body.endDate);

   console.log('Adding category offer:', { percentage, categoryId, endDate });

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }

    // Check if an active offer already exists for this category
    const existingOffer = await Offer.findOne({
      offerType: 'category',
      applicableId: categoryId,
      isActive: true,
    });
    if (existingOffer) {
      return res.status(400).json({
        status: false,
        message: "An active offer already exists for this category",
      });
    }

    // Check if any product in the category has a higher product offer
    const products = await Product.find({ category: category._id });
    const hasProductOffer = products.some(product => product.productOffer > percentage);
    if (hasProductOffer) {
      return res.json({
        status: false,
        message: "Product in this category has higher product offers",
      });
    }

    // Create a new offer document
    const offer = new Offer({
      offerType: 'category',
      name: `Category Offer for ${category.name}`, // Auto-generate the name
      discountPercentage: percentage,
      applicableId: categoryId,
      offerTypeModel: 'Category',
      startDate: new Date(), // Use current date as start date
      endDate: endDate,
      isActive: true,
    });
    await offer.save();

    console.log('Created offer:', offer);

    // Update the category with the offer percentage
    await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } });

    // Apply the offer to all products in the category
    for (const product of products) {
      product.productOffer = 0; // Reset any product-specific offer
      product.salePrice = product.regularPrice - Math.floor(product.regularPrice * (percentage / 100));
      await product.save();
    }

    res.json({ status: true, message: "Category offer added successfully" });

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
    // Reset product prices
    for (const product of products) {
      product.salePrice = product.regularPrice;
      product.productOffer = 0;
      await product.save();
    }
    // Reset the category offer
    category.categoryOffer = 0;
    await category.save();
    // Delete the offer from the Offer collection
    await Offer.deleteOne({ offerType: 'category', applicableId: categoryId });
    res.json({ status: true, message: "Category offer removed successfully" });
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
