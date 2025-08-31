const User = require("../models/userSchema");

const userAuth = (req, res, next) => {  
  // console.log('middleware',req.session);
  if (req.session.user && req.session.user._id) {
    User.findById(req.session.user._id)
      .then(user => {
        if (user && !user.isBlocked && !user.isAdmin) {
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
  if (req.session.admin) {
    // console.log()
    next();
  } else {
    console.log("Auth..... not working")
    res.redirect("/login");
  }
};

module.exports ={
  userAuth,
  adminAuth
}







