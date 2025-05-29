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



router.get('/orders', orderController.listOrders);
router.get('/orders/details/:orderId', orderController.viewOrderDetails);
router.post('/orders/update-status/:orderId',orderController.updateOrderStatus);
router.post('/orders/cancel/:orderId', orderController.processCancelRequest);
router.post('/orders/:orderId/return', orderController.processReturnRequest);
router.get('/orders/invoice/:orderId', orderController.downloadInvoice);
router.get('/orders/timeline/:orderId', orderController.getOrderStatusTimeline);
router.post('/orders/cancel-item/:orderId',orderController.processCancelItemRequest);
router.post('/orders/return-item/:orderId',orderController.processReturnItemRequest);

// Order request routes
router.get('/pending-requests', orderController.getPendingRequests);
router.get('/orders/request-counts', orderController.getRequestCounts);
router.get('/orders/cancel-requests', orderController.getCancelRequests);
router.get('/orders/return-requests', orderController.getReturnRequests);
router.post('/orders/cancel-request/:orderId',orderController.handleCancelRequest);
router.post('/orders/return-request/:orderId',orderController.handleReturnRequest);








module.exports = router;




















