const User = require("../models/userSchema");

const userAuth = (req, res, next) => {  
  if (req.session.user && req.session.user._id) {
    User.findById(req.session.user._id)
      .then(user => {
        if (user && !user.isBlocked && !user.isAdmin) {
          next();
        } else { 
          delete req.session.user;
          res.clearCookie("connect.sid");
          return res.redirect("/login");
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
  if (req.session.admin && req.session.admin._id) {
    next();
  } else {
   res.redirect("/admin/login");
  }
};



module.exports ={
  userAuth,
  adminAuth,
}







