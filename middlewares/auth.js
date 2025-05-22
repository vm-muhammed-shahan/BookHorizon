const User = require("../models/userSchema");

const userAuth = (req, res, next) => {  
  if (req.session.user && req.session.user._id) {
    User.findById(req.session.user._id)
      .then(user => {
        if (user && !user.isBlocked) {
          next();
        } else {
          res.redirect("/login");
        }
      })
      .catch(error => {
        console.error("Error in user auth middleware", error);
        res.status(500).send("Internal Server Error");
      });
  } else {
    res.redirect("/login");
  }
};





const adminAuth = (req, res, next) => {
  if (req.session.user && req.session.user._id) {
    User.findById(req.session.user._id)
      .then(user => {
        if (user && user.isAdmin) {
          next();
        } else {
          res.redirect("/login");
        }
      })
      .catch(error => {
        console.error("Error in adminAuth middleware", error);
        res.status(500).send("Internal Server Error");
      });
  } else {
    res.redirect("/login");
  }
};







// const adminAuth = async (req, res, next) => {
//     res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
//     res.setHeader('Expires', '0');
//     res.setHeader('Pragma', 'no-cache');

//     const path = req.path;
//     if (!protectedAdminRoutes.some(route => path.startsWith(route))) {
//         return next();
//     }

//     if (!req.session.admin) {
        
//         return res.redirect('/admin/login');
//     }

//     try {
//         const adminId = req.session.admin;
//         if (!mongoose.Types.ObjectId.isValid(adminId)) {
            
//             req.session.destroy();
//             return res.redirect('/admin/login');
//         }

//         const admin = await User.findOne({ _id: adminId, isAdmin: true });
//         if (!admin) {
//             req.session.destroy();
//             return res.redirect('/admin/login');
//         }

//         req.admin = admin;
//         next();
//     } catch (error) {
//         console.error('Error in adminAuth middleware:', error);
//         req.session.destroy();
//         res.redirect('/admin/login');
//     }
// };






module.exports ={
  userAuth,
  adminAuth
}







