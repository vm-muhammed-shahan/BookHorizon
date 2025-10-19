const http = require("../../helpers/const");
const Address = require("../../models/addressSchema");
const User = require("../../models/userSchema");
const validator = require("validator");




const getAddresses = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const doc = await Address.findOne({ userId });
    const userData = await User.findById(userId).select('name email');
    res.render("addresses", {
      user: userData,
      addresses: doc?.address || [],
      from: req.query.from || null
    });
  } catch (error) {
    console.error("Error fetching addresses:", error);
    res.status(http.Internal_Server_Error).send("An error occurred while fetching addresses.");
  }
};


const addAddress = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const {
      name,
      phone,
      city,
      state,
      landMark,
      pincode,
      altPhone,
      addressType,
      isDefault
    } = req.body;

    const nameCityRegex = /^[A-Za-z\s.,'-]{2,50}$/;
    const phoneRegex = /^[6-9]\d{9}$/;
    const pincodeRegex = /^[1-9][0-9]{5}$/;
    const invalidPhone = (num) =>
      !phoneRegex.test(num) || /^(\d)\1{9}$/.test(num) || num === "1234567890";
    const isOnlyUnderscoresOrHyphens = (val) =>
      /^_+$/.test(val) || /^-+$/.test(val);

  
    if (!name || !phone || !city || !state || !landMark || !pincode || !altPhone || !addressType) {
      return res.status(http.Bad_Request).json({ error: "All fields are required" });
    }

    
    if (
      !nameCityRegex.test(name) ||
      !nameCityRegex.test(city) ||
      !nameCityRegex.test(state) ||
      !nameCityRegex.test(landMark)
    ) {
      return res.status(http.Bad_Request).json({
        error: "Text fields must be 2–50 characters and valid format",
      });
    }

    
    const fieldsToCheck = { name, city, state, landMark };
    for (const [key, value] of Object.entries(fieldsToCheck)) {
      if (isOnlyUnderscoresOrHyphens(value)) {
        return res.status(http.Bad_Request).json({ error: `${key} cannot be only underscores or hyphens` });
      }
    }

    
    if (invalidPhone(phone) || invalidPhone(altPhone)) {
      return res.status(http.Bad_Request).json({
        error: "Phone numbers must be valid 10-digit numbers starting with 6–9",
      });
    }

    if (phone === altPhone) {
      return res.status(http.Bad_Request).json({
        error: "Phone and Alternative Phone must be different",
      });
    }

    
    if (!pincodeRegex.test(pincode)) {
      return res.status(http.Bad_Request).json({ error: "Pincode must be a valid 6-digit Indian pincode" });
    }

    let doc = await Address.findOne({ userId });
    const updatedIsDefault = isDefault === true || isDefault === "true" || isDefault === "on";

    const newAddr = {
      name,
      phone,
      city,
      state,
      landMark,
      pincode,
      altPhone,
      addressType,
      isDefault: updatedIsDefault || !doc || doc.address.length === 0,
    };

    if (!doc) {
      doc = new Address({ userId, address: [newAddr] });
    } else {
      if (newAddr.isDefault) {
        doc.address.forEach((addr) => (addr.isDefault = false));
      }
      doc.address.push(newAddr);
    }

    await doc.save();
    const savedAddr = doc.address[doc.address.length - 1]; 
    if (req.xhr || req.headers.accept?.includes("application/json")) {
  return res.status(http.OK).json({ success: true, message: "Address saved successfully",newAddress: savedAddr });
}

if (req.body.from === "checkout") {
  return res.redirect("/checkout");
} else {
  return res.redirect("/profile/addresses");
}
  } catch (err) {
    console.error("Address Error:", err);
    return res
      .status(http.Internal_Server_Error)
      .json({ error: "Server error while adding address" });
  }
};


const getEdit = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const addrId = req.query.addrId;

    const doc = await Address.findOne({ userId });
    const address = doc.address.id(addrId);

    if (!address) {
      return res.status(http.Not_Found).send("Address not found");
    }

    res.render("edit-address", { address });
  } catch (error) {
    console.log(error);
    res.status(http.Internal_Server_Error).send("Server Error");
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

    
    const nameCityRegex = /^[A-Za-z\s.,'-]{2,50}$/;
    const phoneRegex = /^[6-9]\d{9}$/;
    const pincodeRegex = /^[1-9][0-9]{5}$/; 
    const invalidPhone = (num) =>
      !phoneRegex.test(num) || /^(\d)\1{9}$/.test(num) || num === "1234567890";
    const isOnlyUnderscoresOrHyphens = (val) =>
      /^_+$/.test(val) || /^-+$/.test(val);

    
    if (!name || !phone || !city || !state || !landMark || !pincode || !altPhone || !addressType) {
      return res.status(http.Bad_Request).json({ error: "All fields are required" });
    }

    
    if (
      !nameCityRegex.test(name) ||
      !nameCityRegex.test(city) ||
      !nameCityRegex.test(state) ||
      !nameCityRegex.test(landMark)
    ) {
      return res.status(http.Bad_Request).json({
        error: "Text fields must be 2–50 characters and valid format",
      });
    }

    
    const fieldsToCheck = { name, city, state, landMark };
    for (const [key, value] of Object.entries(fieldsToCheck)) {
      if (isOnlyUnderscoresOrHyphens(value)) {
        return res.status(http.Bad_Request).json({ error: `${key} cannot be only underscores or hyphens` });
      }
    }

    
    if (invalidPhone(phone) || invalidPhone(altPhone)) {
      return res.status(http.Bad_Request).json({
        error: "Phone numbers must be valid 10-digit numbers starting with 6–9",
      });
    }

    if (phone === altPhone) {
      return res.status(http.Bad_Request).json({
        error: "Phone and Alternative Phone must be different",
      });
    }

    
    if (!pincodeRegex.test(pincode)) {
      return res.status(http.Bad_Request).json({ error: "Pincode must be a valid 6-digit Indian pincode" });
    }

    
    const doc = await Address.findOne({ userId });
    if (!doc) {
      return res.status(http.Not_Found).json({ error: "User address record not found" });
    }

  
    const index = doc.address.findIndex((a) => a._id.toString() === addrId);
    if (index === -1) {
      return res.status(http.Not_Found).json({ error: "Address not found" });
    }

    const updatedIsDefault =
      isDefault === true || isDefault === "true" || isDefault === "on";

    
    doc.address[index] = {
      ...doc.address[index]._doc, 
      name,
      phone,
      city,
      state,
      landMark,
      pincode,
      altPhone,
      addressType,
      isDefault: updatedIsDefault,
    };

    
    if (updatedIsDefault) {
      doc.address.forEach((addr, i) => {
        if (i !== index) addr.isDefault = false;
      });
    }

    await doc.save();
    console.log("Address updated successfully:", doc.address[index]);
    return res.status(http.OK).json({ success: true, message: "Address updated successfully" });
  } catch (err) {
    console.error("Error updating address:", err);
    return res.status(http.Internal_Server_Error).json({ error: "Server error while updating address" });
  }
};



const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { addrId } = req.params;

    const doc = await Address.findOne({ userId });
    if (!doc) {
      return res.status(http.Not_Found).json({ error: 'User address record not found' });
    }

    const index = doc.address.findIndex(a => a._id.toString() === addrId);
    if (index === -1) {
      return res.status(http.Not_Found).json({ error: 'Address not found' });
    }

    const wasDefault = doc.address[index].isDefault;

    doc.address.splice(index, 1);
    if (wasDefault && doc.address.length > 0) {
      doc.address[0].isDefault = true;
    }

    await doc.save();
    return res.status(http.OK).json({ success: true, message: 'Address deleted successfully' });
  } catch (err) {
    console.error("Error deleting address:", err);
    return res.status(http.Internal_Server_Error).json({ error: 'Server error while deleting address' });
  }
};


const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { addrId } = req.params;

    const doc = await Address.findOne({ userId });
    if (!doc) {
      return res.status(http.Not_Found).json({ error: 'User address record not found' });
    }

    const index = doc.address.findIndex(a => a._id.toString() === addrId);
    if (index === -1) {
      return res.status(http.Not_Found).json({ error: 'Address not found' });
    }
    doc.address.forEach((addr, i) => {
      addr.isDefault = i === index;
    });

    await doc.save();
    return res.status(http.OK).json({ success: true, message: 'Default address updated successfully' });
  } catch (err) {
    console.error("Error setting default address:", err);
    return res.status(http.Internal_Server_Error).json({ error: 'Server error while setting default address' });
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