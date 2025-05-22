const Address = require("../../models/addressSchema");

// 1. GET all addresses
const getAddresses = async (req, res) => {
  const userId = req.session.user._id;
  const doc = await Address.findOne({ userId });
  res.render("addresses", { addresses: doc?.address || [] });
};


// 2. ADD new address
const addAddress = async (req, res) => {
  const userId = req.session.user._id;
  const newAddr = req.body;

  let doc = await Address.findOne({ userId });

  // If it's the first address, set default true
  newAddr.isDefault = !doc || doc.address.length === 0;

  if (!doc) {
    doc = new Address({ userId, address: [newAddr] });
  } else {
    // If this is marked as default, reset others
    if (newAddr.isDefault) {
      doc.address.forEach(addr => (addr.isDefault = false));
    }
    doc.address.push(newAddr);
  }

  await doc.save();
  res.redirect("/profile/addresses");
};



// 3. EDIT address
const editAddress = async (req, res) => {
  const userId = req.session.user._id;
  const { addrId } = req.params;
  const updated = req.body;

  const doc = await Address.findOne({ userId });
  const addr = doc.address.id(addrId);

  if (!addr) return res.status(404).send("Address not found");

  if (updated.isDefault) {
    doc.address.forEach(a => (a.isDefault = false));
  }

  Object.assign(addr, updated);
  await doc.save();
  res.redirect("/profile/addresses");
};


// 4. DELETE address
const deleteAddress = async (req, res) => {
  const userId = req.session.user._id;
  const { addrId } = req.params;

  const doc = await Address.findOne({ userId });
  doc.address.id(addrId).remove();

  // If default deleted, assign default to another
  if (!doc.address.some(a => a.isDefault) && doc.address.length > 0) {
    doc.address[0].isDefault = true;
  }

  await doc.save();
  res.redirect("/profile/addresses");
};




// 5. Set Default Address
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


module.exports={
  getAddresses,
  addAddress,
  editAddress,
 deleteAddress,
setDefaultAddress,

};