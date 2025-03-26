// const express = require("express");
// const router = express.Router();
// const path = require('path');

// // // const userController = require(path.join(__dirname, '..', 'controllers', 'user', 'userController'));
//  //const userController = require('../controllers/userController'); // Ensure correct path

//  const userController = require('../controllers/user/userController');

// router.get("/", userController.loadHomepage);

// module.exports = router;

const express = require("express");
const router = express.Router();

console.log("✅ userRouter.js loaded");

const userController = require('../controllers/user/userController');

if (!userController) {
    console.error("❌ userController is not found");
} else {
    console.log("✅ userController loaded");
}

router.get("/pageNotFound",userController.pageNotFound);

router.get("/", (req, res) => {
    console.log("✅ / route hit");
    userController.loadHomepage(req, res);
});





module.exports = router;
