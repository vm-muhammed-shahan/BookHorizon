const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Offer = require("../../models/offerSchema");
const { applyBestOffer } = require("../admin/productController");


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

    const now = new Date();
    const offers = await Offer.find({
      offerType: 'category',
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    });

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
    const startDate = new Date(req.body.startDate);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    if (startDate < startOfToday) {
      return res.status(400).json({
        status: false,
        message: "Start date cannot be in the past",
      });
    }

    const endDate = new Date(req.body.endDate);
    endDate.setHours(23, 59, 59, 999);


    if (endDate < startDate) {
      return res.status(400).json({
        status: false,
        message: "End date cannot be before start date",
      });
    }


    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }

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

    const products = await Product.find({ category: category._id });
    const hasProductOffer = products.some(product => product.productOffer > percentage);
    if (hasProductOffer) {
      return res.json({
        status: false,
        message: "Product in this category has higher product offers",
      });
    }

    const offer = new Offer({
      offerType: 'category',
      name: `Category Offer for ${category.name}`,
      discountPercentage: percentage,
      applicableId: categoryId,
      offerTypeModel: 'Category',
      startDate: startDate,
      endDate: endDate,
      isActive: true,
    });
    await offer.save();

    await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } });

    for (const product of products) {
      const { discountedPrice } = await applyBestOffer(product, null, categoryId);
      product.salePrice = discountedPrice;
      product.productOffer = 0;
      product.categoryOffer = percentage;
      product.productOffer = 0; 
      product.salePrice = product.regularPrice - Math.floor(product.regularPrice * (percentage / 100));
      await product.save();
    }

    res.json({ status: true, message: "Category offer added successfully", offer: offer });
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
      product.categoryOffer = 0;
      await product.save();
    }

    category.categoryOffer = 0;
    await category.save();

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
      return res.status(400).json({ success: false, message: "A category with this name already exists" });
    }
    const updated = await Category.findByIdAndUpdate(
      id,
      { name: categoryName, description },
      { new: true }
    );
    if (updated) {
      return res.json({ success: true, message: "Category updated successfully" });
    } else {
      return res.status(404).json({ success: false, message: "Category not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
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
