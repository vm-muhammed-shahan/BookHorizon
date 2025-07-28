const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const orderController = require("../controllers/admin/orderController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const couponController = require('../controllers/admin/couponController');
const salesController = require('../controllers/admin/salesController');
const dashboardController = require('../controllers/admin/dashboardController');
const uploads = require("../helpers/multer");
const { adminAuth } = require("../middlewares/auth");


// Page Error
router.get("/pageerror", adminController.pageerror);



// Login Management
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/", adminAuth, customerController.customerInfo)
router.get("/logout", adminController.logout);



// Customer Management
router.get("/users", adminAuth, customerController.customerInfo);
router.get("/blockCustomer", adminAuth, customerController.customerBlocked);
router.get("/unblockCustomer", adminAuth, customerController.customerunBlocked);
router.get("/users/ajax", adminAuth, adminController.getAjaxUsers);



// Category Management 
router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.post("/addCategoryOffer", adminAuth, categoryController.addCategoryOffer);
router.post("/removeCategoryOffer", adminAuth, categoryController.removeCategoryOffer);
router.post("/listCategory", adminAuth, categoryController.getListCategory);
router.post("/unlistCategory", adminAuth, categoryController.getUnlistCategory);
router.get("/editCategory", adminAuth, categoryController.getEditCategory);
router.post("/editCategory/:id", adminAuth, categoryController.editCategory);


router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post("/addProducts", uploads.array('productImages', 3), adminAuth, productController.addProducts);
router.get("/products", adminAuth, productController.getAllProducts);
router.post("/blockProduct/:id", adminAuth, productController.blockProduct);
router.post("/unblockProduct/:id", adminAuth, productController.unblockProduct);
router.post("/addProductOffer", adminAuth, productController.addProductOffer);
router.post("/removeProductOffer", adminAuth, productController.removeProductOffer);
router.get("/editProduct", adminAuth, productController.getEditProduct);
router.post("/editProduct/:id", adminAuth, 
  uploads.fields([
    { name: 'images[0]', maxCount: 1 },
    { name: 'images[1]', maxCount: 1 },
    { name: 'images[2]', maxCount: 1 }
  ]), 
  productController.editProduct
);
router.post("/deleteImage", adminAuth, productController.deleteSingleImage);


// Order Management
router.get("/orders", adminAuth, orderController.getOrders);
router.get("/orders/clear", adminAuth, orderController.clearFilters);
router.get("/orders/:orderId", adminAuth, orderController.getOrderDetails);
router.post("/orders/:orderId/status", adminAuth, orderController.updateOrderStatus);
router.post("/orders/:orderId/return", adminAuth, orderController.verifyReturnRequest);


// Sales Report
router.get("/salesReport", adminAuth, salesController.getSalesReportPage);
router.get("/sales-report/download", adminAuth, salesController.downloadSalesReport);


// Coupon Management
router.get('/coupons', adminAuth, couponController.getCouponPage);
router.post('/coupons/create', adminAuth, couponController.createCoupon);
router.post('/coupons/delete/:couponId', adminAuth, couponController.deleteCoupon);




// Dashboard Management
router.get("/dashboard", adminAuth, dashboardController.getDashboard);



module.exports = router;
