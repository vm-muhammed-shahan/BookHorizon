const Brand = require("../../models/BannerSchema");
const Product = require("../../models/productSchema");


const getBrandPage = async (req,res)=>{
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page -1)*limit;
    const brandData = await Brand.find({}).sort({createdAt:-1}).skip(skip).limit(limit);
    const totalBrands = await Brand.countDocuments();
    const totalPages = Math.ceil(totalBrands/limit);
    const reverseBrand = brandData.reverse();
    res.render("brand",{
      data:reverseBrand,
      currentPage:page,
      totalPages:totalPages,
      totalBrands:totalBrands,

    })                            
  } catch (error) {
    res.redirect("/pageerror")
  }
}

module.exports = {
  getBrandPage
}