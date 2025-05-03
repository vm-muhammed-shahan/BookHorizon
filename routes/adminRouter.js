const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const brandController = require("../controllers/admin/brandController");
const productController = require("../controllers/admin/productController");
const uploads = require("../helpers/multer");


const { userAuth, adminAuth } = require("../middlewares/auth");

// Page Error
router.get("/pageerror", adminController.pageerror);

// Login Management
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/", adminAuth, adminController.loadDashboard);
router.get("/logout", adminController.logout);

//Live Customer Search
router.get("/users/ajax", adminAuth, adminController.getAjaxUsers);

// Customer Management
router.get("/users", adminAuth, customerController.customerInfo);
router.get("/blockCustomer", adminAuth, customerController.customerBlocked);
router.get("/unblockCustomer", adminAuth, customerController.customerunBlocked);

// Category Management 
router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
 router.post("/addCategoryOffer", adminAuth, categoryController.addCategoryOffer);
 router.post("/removeCategoryOffer", adminAuth, categoryController.removeCategoryOffer);
router.post("/listCategory", adminAuth, categoryController.getListCategory);
router.post("/unlistCategory", adminAuth, categoryController.getUnlistCategory);
router.get("/editCategory", adminAuth, categoryController.getEditCategory);
router.post("/editCategory/:id", adminAuth, categoryController.editCategory);

// Product Management
router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post("/addProducts", uploads.array('productImages', 3), adminAuth, productController.addProducts);
router.get("/products", adminAuth, productController.getAllProducts);
router.get("/blockProduct", adminAuth, productController.blockProduct);
router.get("/unblockProduct", adminAuth, productController.unblockProduct);
router.get("/editProduct", adminAuth, productController.getEditProduct);
router.post("/editProduct/:id", adminAuth, uploads.array("images", 3), productController.editProduct);
router.post("/deleteImage", adminAuth, productController.deleteSingleImage);

module.exports = router;




















