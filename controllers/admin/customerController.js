const User = require("../../models/userSchema");


const customerInfo = async(req,res)=>{
  try {
    
    let search="";
    if(req.query.search){
         search=req.query.search;
    }
    let page=1;
    if(req.query.page){
      page= parseInt(req.query.page   )                                
    }

    const limit = 3;
    const userData = await User.find({
      isAdmin:false,
      $or:[
       {name:{$regex: ".*" +search+".*"}},
       {email:{$regex: ".*" +search+".*"}}
      ],
       })
    .limit(limit*1)
    .skip((page-1)*limit)
    .exec();

    const count =     await User.find({
      isAdmin:false,
      $or:[

       {name:{$regex: ".*" +search+".*",$options: "i"}},
       {email:{$regex: ".*" +search+".*",$options: "i"}},

      ],
    }).countDocuments();

      // res.render('customers');

      // res.render("customers", {
      //   data: userData, 
      //   totalPages: Math.ceil(count / limit),
      //   currentPage: page
      // });



      res.render("customers", {
        data: userData, 
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        searchQuery: search // ✅ Add this
      });
      

      
    

  } catch (error) {
    res.redirect('/pageerror')
  }
};



const customerBlocked = async (req, res) => {
  try {
    const id = req.query.id;
    const page = req.query.page || 1; // ⬅️ get current page from query
    await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect(`/admin/users?page=${page}`); // ⬅️ redirect to the same page
  } catch (error) {
    res.redirect("/pageerror");
  }
};


const customerunBlocked = async (req, res) => {
  try {
    const id = req.query.id;
    const page = req.query.page || 1; // ⬅️ get current page from query
    await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect(`/admin/users?page=${page}`); // ⬅️ redirect to the same page
  } catch (error) {
    res.redirect("/pageerror");
  }
};


module.exports = {
  customerInfo,
  customerBlocked,
  customerunBlocked,                                
}















