const User = require("../models/userSchema");


// const userAuth = (req,res,next)=>{
//   console.log(" Checking Admin Authentication...");

//   if(req.session.user){
//     // User.findById(req.session.user)
//     req.session.user._id 
//     .then(data=>{
//       if(data && !data.isBlocked){
//         next();
//       }else{
//         res.redirect("/login")
//       }
//     })
//     .catch(error=>{
//       // console.log("Error in user auth middleware");
//       res.status(500).send("Internal Server error")
//     })
//   }else{
//      res.redirect("/login")
//   }
// }





const userAuth = (req, res, next) => {
  // console.log("Checking User Authentication...");
  // console.log("User session: ", req.session.user);

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






const  adminAuth = (req,res,next)=>{
  User.findOne({isAdmin:true})
  .then(data=>{
    if(data){
      next();
    }else{
      res.redirect("/admin/login")
    }
  })
  .catch(error=>{
    console.log("Error in adminauth middleware",error);
    res.status(500).send("Internal Server Error")
  })
}


module.exports ={
  userAuth,
  adminAuth
}







