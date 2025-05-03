const User = require("../../models/userSchema");

   
const customerInfo = async (req, res) => {
  try {

    let search = "";
    if (req.query.search) {
      search = req.query.search;
    }
    let page = 1;
    if (req.query.page) {
      page = parseInt(req.query.page)
    }

    const limit = 5;
    const userData = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    })
      .sort({ _id: -1})
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await User.find({
      isAdmin: false,
      $or: [

        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },

      ],
    }).countDocuments();

    res.render("customers", {
      data: userData,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      searchQuery: search
    });

  } catch (error) {
    res.redirect('/pageerror')
  }
};


const customerBlocked = async (req, res) => {
  try {
    const id = req.query.id;
    const page = req.query.page || 1;

    await User.updateOne({ _id: id }, { $set: { isBlocked: true } });

    res.json({
      success: true,
      message: "Customer blocked successfully",
      id,
      page,
    });
  } catch (error) {
    res.json({ success: false, message: "Failed to block customer" });
  }
};



const customerunBlocked = async (req, res) => {
  try {
    const id = req.query.id;
    const page = req.query.page || 1;

    await User.updateOne({ _id: id }, { $set: { isBlocked: false } });

    res.json({
      success: true,
      message: "Customer unblocked successfully",
      id,
      page,
    });
  } catch (error) {
    res.json({ success: false, message: "Failed to unblock customer" });
  }
};


module.exports = {
  customerInfo,
  customerBlocked,
  customerunBlocked,
}
