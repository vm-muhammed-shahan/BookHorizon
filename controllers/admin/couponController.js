const http = require('../../helpers/const');
const Coupon = require('../../models/couponSchema');

const getCouponPage = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdOn: -1 });
    res.render('couponManagement', { coupons });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(http.Internal_Server_Error).render('error', { message: 'Error loading coupon management page' });
  }
};


const createCoupon = async (req, res) => {
  try {
    const { name, discountPercentage, minimumPrice, expireOn } = req.body;

    if (!name || !discountPercentage || !minimumPrice || !expireOn) {
      return res.status(http.Bad_Request).json({ error: 'All fields are required' });
    }

    const trimmedName = name.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,20}$/.test(trimmedName)) {
      return res.status(http.Bad_Request).json({ error: 'Coupon name must be 3-20 characters containing only uppercase letters and numbers' });
    }

    const existingCoupon = await Coupon.findOne({ name: trimmedName });
    if (existingCoupon) {
      return res.status(http.Bad_Request).json({ error: 'Coupon code already exists' });
    }

    const discountPercentageNum = parseInt(discountPercentage);
    if (isNaN(discountPercentageNum) || discountPercentageNum < 1 || discountPercentageNum > 99) {
      return res.status(http.Bad_Request).json({ error: 'Discount percentage must be an integer between 1 and 99' });
    }

    const minimumPriceNum = parseInt(minimumPrice);
    if (isNaN(minimumPriceNum) || minimumPriceNum <= 0) {
      return res.status(http.Bad_Request).json({ error: 'Minimum purchase must be a positive integer' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expiryDate = new Date(expireOn);
    expiryDate.setHours(0, 0, 0, 0);
    if (isNaN(expiryDate.getTime()) || expiryDate < tomorrow) {
      return res.status(http.Bad_Request).json({ error: 'Expiry date must be in the future (not today)' });
    }

    const coupon = new Coupon({
      name: trimmedName,
      discountPercentage: discountPercentageNum,
      minimumPrice: minimumPriceNum,
      expireOn: expiryDate,
      islist: true,
      userId: []
    });

    await coupon.save();
    res.json({ success: true, message: 'Coupon created successfully' });
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(http.Internal_Server_Error).json({ error: `Server error: ${error.message}` });
  }
};


const editCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const { name, discountPercentage, minimumPrice, expireOn, usageLimit } = req.body;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(http.Not_Found).json({ error: 'Coupon not found' });
    }

    if (name) {
      const trimmedName = name.trim().toUpperCase();
      if (!/^[A-Z0-9]{3,20}$/.test(trimmedName)) {
        return res.status(http.Bad_Request).json({ error: 'Coupon name must be 3-20 characters containing only uppercase letters and numbers' });
      }
      const existingCoupon = await Coupon.findOne({ name: trimmedName, _id: { $ne: couponId } });
      if (existingCoupon) {
        return res.status(http.Bad_Request).json({ error: 'Another coupon with this name already exists' });
      }
      coupon.name = trimmedName;
    }

    if (discountPercentage !== undefined) {
      const discountPercentageNum = parseInt(discountPercentage);
      if (isNaN(discountPercentageNum) || discountPercentageNum < 1 || discountPercentageNum > 99) {
        return res.status(http.Bad_Request).json({ error: 'Discount percentage must be an integer between 1 and 99' });
      }
      coupon.discountPercentage = discountPercentageNum;
    }

    if (minimumPrice !== undefined) {
      const minimumPriceNum = parseInt(minimumPrice);
      if (isNaN(minimumPriceNum) || minimumPriceNum <= 0) {
        return res.status(http.Bad_Request).json({ error: 'Minimum purchase must be a positive integer' });
      }
      coupon.minimumPrice = minimumPriceNum;
    }

    if (expireOn) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expiryDate = new Date(expireOn);
      expiryDate.setHours(0, 0, 0, 0);
      if (isNaN(expiryDate.getTime()) || expiryDate < tomorrow) {
        return res.status(http.Bad_Request).json({ error: 'Expiry date must be in the future (not today)' });
      }
      coupon.expireOn = expiryDate;
    }

    if (usageLimit !== undefined) {
      const usageLimitNum = parseInt(usageLimit);
      if (isNaN(usageLimitNum) || usageLimitNum < 1) {
        return res.status(http.Bad_Request).json({ error: 'Usage limit must be at least 1' });
      }
      coupon.usageLimit = usageLimitNum;
    }

    await coupon.save();
    res.json({ success: true, message: 'Coupon updated successfully', coupon });
  } catch (error) {
    console.error('Error editing coupon:', error);
    res.status(http.Internal_Server_Error).json({ error: `Server error: ${error.message}` });
  }
};


const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const { islist } = req.body;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(http.Bad_Request).json({ error: 'Coupon not found' });
    }

    coupon.islist = islist;
    await coupon.save();

    res.json({
      success: true,
      message: islist ? 'Coupon restored successfully' : 'Coupon deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting/restoring coupon:', error);
    res.status(http.Internal_Server_Error).json({ error: 'Server error while deleting/restoring coupon' });
  }
};

module.exports = {
  getCouponPage,
  createCoupon,
  deleteCoupon,
  editCoupon,
};        