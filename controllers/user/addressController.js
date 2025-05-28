const Address = require("../../models/addressSchema");

// 1. GET all addresses
const getAddresses = async (req, res) => {
  const userId = req.session.user._id;
  const doc = await Address.findOne({ userId });
  res.render("addresses", { addresses: doc?.address || [] });
};



const addAddress = async (req, res) => {
  try{
      const userId = req.session.user._id;
  const newAddr = req.body;
  const requiredFields = ['name', 'phone', 'city', 'state', 'landMark', 'pincode', 'altPhone', 'addressType'];
  for (let field of requiredFields) {
    if (!newAddr[field] || newAddr[field].trim() === '') {
      return res.redirect('/profile/addresses?error=Missing+required+fields');
    }
  }
  let doc = await Address.findOne({ userId });
  newAddr.isDefault = !doc || doc.address.length === 0;
  if (!doc) {
    doc = new Address({ userId, address: [newAddr] });
  } else {
    if (newAddr.isDefault) {
      doc.address.forEach(addr => (addr.isDefault = false));
    }
    doc.address.push(newAddr);
  }
  await doc.save();
  //  Redirect with a success query param
  res.redirect('/profile/addresses?success=1');
} catch (err) {
  console.error(err);
  res.redirect('/profile/addresses?error=Something+went+wrong');
}
};



const getEdit = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const addrId = req.query.addrId;

    const doc = await Address.findOne({ userId });
    const address = doc.address.id(addrId);

    if (!address) {
      return res.status(404).send("Address not found");
    }

    res.render("edit-address", { address });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};



const editAddress = async (req, res) => {
  try{
  const userId = req.session.user._id;
  const { addrId } = req.params;
  const updated = req.body;

    // Validation
    const requiredFields = ['name', 'phone', 'city', 'state', 'landMark', 'pincode', 'altPhone', 'addressType'];
    for (let field of requiredFields) {
      if (!updated[field] || updated[field].trim() === '') {
        return res.redirect('/profile/addresses?error=Missing+required+fields+for+edit');
      }
    }
  const doc = await Address.findOne({ userId });
  const addr = doc.address.id(addrId);
  if (!addr) return res.redirect('/profile/addresses?error=Address+not+found');

  updated.isDefault = req.body.isDefault === "on";
  if (updated.isDefault) {
    doc.address.forEach(a => (a.isDefault = false));
  }
  Object.assign(addr, updated);
  await doc.save();
  res.redirect('/profile/addresses?success=edit');
} catch (err) {
    console.error(err);
    res.redirect('/profile/addresses?error=Failed+to+edit+address');
  }
};



const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { addrId } = req.params;

    const doc = await Address.findOne({ userId });
    if (!doc) {
       return res.redirect('/profile/addresses?error=User+address+record+not+found');
    }

    const index = doc.address.findIndex(a => a._id.toString() === addrId);
    if (index === -1) {
     return res.redirect('/profile/addresses?error=Address+not+found');
    }
    const wasDefault = doc.address[index].isDefault;
    // Remove the address
    doc.address.splice(index, 1);
    // If default address was deleted, set another as default
    if (wasDefault && doc.address.length > 0) {
      doc.address[0].isDefault = true;
    }

    await doc.save();
    res.redirect('/profile/addresses?success=delete');
  } catch (err) {
    console.error("Error deleting address:", err);
    res.status(500)
  }
};





const setDefaultAddress = async (req, res) => {
  const userId = req.session.user._id;
  const { addrId } = req.params;

  const doc = await Address.findOne({ userId });

  doc.address.forEach(addr => {
    addr.isDefault = addr._id.toString() === addrId;
  });

  await doc.save();
  res.redirect("/profile/addresses");
};


module.exports = {
  getAddresses,
  addAddress,
  editAddress,
  deleteAddress,
  setDefaultAddress,
  getEdit
};