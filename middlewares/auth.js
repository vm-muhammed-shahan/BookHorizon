const User = require("../models/userSchema");


const userAuth = (req,res,next)=>{
  console.log("🔍 Checking Admin Authentication...");

  if(req.session.user){
    User.findById(req.session.user)
    .then(data=>{
      if(data && !data.isBlocked){
        next();
      }else{
        res.redirect("/login")
      }
    })
    .catch(error=>{
      // console.log("Error in user auth middleware");
      res.status(500).send("Internal Server error")
    })
  }else{
     res.redirect("/login")
  }
}


// const adminAuth = (req, res, next) => {

//   if (!req.session.user) {
//     return res.redirect("/admin/login");
//   }

//   User.findById(req.session.user)
//     .then(user => {
//       if (user && user.isAdmin) {
//         next();
//       } else {
//         res.redirect("/admin/login");
//       }
//     })
//     .catch(error => {
//       res.status(500).json({ error: "Internal Server Error" });
//     });
// };




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






