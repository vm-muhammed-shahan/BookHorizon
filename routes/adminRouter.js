const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const orderController = require("../controllers/admin/orderController")
const categoryController = require("../controllers/admin/categoryController");
const brandController = require("../controllers/admin/brandController");
const productController = require("../controllers/admin/productController");
const uploads = require("../helpers/multer");
const {adminAuth } = require("../middlewares/auth");



// Page Error
router.get("/pageerror", adminController.pageerror);



// Login Management
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/", adminAuth, adminController.loadDashboard);
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



// Product Management
router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post("/addProducts", uploads.array('productImages', 3), adminAuth, productController.addProducts);
router.get("/products", adminAuth, productController.getAllProducts);
router.post("/blockProduct/:id", adminAuth, productController.blockProduct);
router.post("/unblockProduct/:id", adminAuth, productController.unblockProduct);
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












// order Management



// List orders - Static route first
router.get("/orders", adminAuth, orderController.getOrders);

// Clear filters
router.get("/orders/clear", adminAuth, orderController.clearFilters);

// View order details - Dynamic route after static routes
router.get("/orders/:orderId", adminAuth, orderController.getOrderDetails);

// Update order status
router.post("/orders/:orderId/status", adminAuth, orderController.updateOrderStatus);

// Verify return request
router.post("/orders/:orderId/return", adminAuth, orderController.verifyReturnRequest);




module.exports = router;




















