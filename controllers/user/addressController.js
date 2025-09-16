const Address = require("../../models/addressSchema");
const validator = require("validator");
const isOnlyUnderscoresOrHyphens = (value) => {
  return /^_+$/.test(value) || /^-+$/.test(value);
};



const getAddresses = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const doc = await Address.findOne({ userId });
    res.render("addresses", { addresses: doc?.address || [] });
  } catch (error) {
    console.error("Error fetching addresses:", error);
    res.status(500).send("An error occurred while fetching addresses.");
  }
};


const addAddress = async (req, res) => {
  try { 
    const userId = req.session.user._id;
    const {
      name, phone, city, state,
      landMark, pincode, altPhone, addressType
    } = req.body;

    const phoneRegex = /^[6-9]\d{9}$/;
    const pincodeRegex = /^\d{6}$/;

    if (!name || !phone || !city || !state || !landMark || !pincode || !altPhone || !addressType) {
      return res.redirect('/profile/addresses?error=All+fields+are+required');
    }

    if (!phoneRegex.test(phone) || !phoneRegex.test(altPhone)) {
      return res.redirect('/profile/addresses?error=Phone+numbers+must+be+10+digit+valid+numbers');
    }

    if (phone === altPhone) {
      return res.redirect('/profile/addresses?error=Phone+and+Alternative+Phone+must+be+different');
    }

    if (!pincodeRegex.test(pincode)) {
      return res.redirect('/profile/addresses?error=Pincode+must+be+6+digits');
    }

    let doc = await Address.findOne({ userId });
    const newAddr = {
      name, phone, city, state, landMark, pincode,
      altPhone, addressType,
      isDefault: !doc || doc.address.length === 0
    };

    if (!doc) {
      doc = new Address({ userId, address: [newAddr] });
    } else {
      if (newAddr.isDefault) {
        doc.address.forEach(addr => (addr.isDefault = false));
      }
      doc.address.push(newAddr);
    }

    await doc.save();
    console.log("Address saved successfully");
    return res.status(200).json({success:true, message: 'address saved successfully'});
  } catch (err) {
    console.error("Address Error:", err);
    return res.status(500).json({ error: 'Server error while adding address' });
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
  try {
    const userId = req.session.user._id;
    const { addrId } = req.params;
    const {
      name, phone, city, state,
      landMark, pincode, altPhone, addressType, isDefault
    } = req.body;

    const phoneRegex = /^[6-9]\d{9}$/;
    const pincodeRegex = /^\d{6}$/;
    const isOnlyUnderscoresOrHyphens = (val) =>
      /^_+$/.test(val) || /^-+$/.test(val);

    if (!name || !phone || !city || !state || !landMark || !pincode || !altPhone || !addressType) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const fieldsToCheck = { name, city, state, landMark };
    for (const [key, value] of Object.entries(fieldsToCheck)) {
      if (isOnlyUnderscoresOrHyphens(value)) {
        return res.status(400).json({ error: `${key} cannot be only underscores or hyphens` });
      }
    }

    if (!phoneRegex.test(phone) || !phoneRegex.test(altPhone)) {
      return res.status(400).json({ error: 'Phone numbers must be 10-digit valid numbers' });
    }

    if (phone === altPhone) {
      return res.status(400).json({ error: 'Phone and Alternative Phone must be different' });
    }

    if (!pincodeRegex.test(pincode)) {
      return res.status(400).json({ error: 'Pincode must be 6 digits' });
    }

    const doc = await Address.findOne({ userId });
    if (!doc) {
      return res.status(404).json({ error: 'User address record not found' });
    }

    const index = doc.address.findIndex(a => a._id.toString() === addrId);
    if (index === -1) {
      return res.status(404).json({ error: 'Address not found' });
    }
    const updatedIsDefault = isDefault === true || isDefault === 'true' || isDefault === 'on';
    doc.address[index] = {
      name, phone, city, state, landMark, pincode,
      altPhone, addressType,
      isDefault: updatedIsDefault
    };

    if (updatedIsDefault) {
      doc.address.forEach((addr, i) => {
        if (i !== index) addr.isDefault = false;
      });
    }

    await doc.save();
    console.log("Address updated successfully:", doc.address[index]); 
    return res.status(200).json({ success: true, message: 'Address updated successfully' });
  } catch (err) {
    console.error("Error updating address:", err);
    return res.status(500).json({ error: 'Server error while updating address' });
  }
};


const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { addrId } = req.params;

    const doc = await Address.findOne({ userId });
    if (!doc) {
      return res.status(404).json({ error: 'User address record not found' });
    }

    const index = doc.address.findIndex(a => a._id.toString() === addrId);
    if (index === -1) {
      return res.status(404).json({ error: 'Address not found' });
    }

    const wasDefault = doc.address[index].isDefault;
    
    doc.address.splice(index, 1);
    if (wasDefault && doc.address.length > 0) {
      doc.address[0].isDefault = true;
    }

    await doc.save();
    return res.status(200).json({ success: true, message: 'Address deleted successfully' });
  } catch (err) {
    console.error("Error deleting address:", err);
    return res.status(500).json({ error: 'Server error while deleting address' });
  }
};


const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { addrId } = req.params;

    const doc = await Address.findOne({ userId });
    if (!doc) {
      return res.status(404).json({ error: 'User address record not found' });
    }

    const index = doc.address.findIndex(a => a._id.toString() === addrId);
    if (index === -1) {
      return res.status(404).json({ error: 'Address not found' });
    }
    doc.address.forEach((addr, i) => {
      addr.isDefault = i === index;
    });

    await doc.save();
    return res.status(200).json({ success: true, message: 'Default address updated successfully' });
  } catch (err) {
    console.error("Error setting default address:", err);
    return res.status(500).json({ error: 'Server error while setting default address' });
  }
};



module.exports = {
  getAddresses,
  addAddress,
  editAddress,
  deleteAddress,
  setDefaultAddress,
  getEdit
};