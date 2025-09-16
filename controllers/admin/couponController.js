const Coupon = require('../../models/couponSchema');

const getCouponPage = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdOn: -1 });
    res.render('couponManagement', { coupons });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).render('error', { message: 'Error loading coupon management page' });
  }
};


const createCoupon = async (req, res) => {
  try {
    const { name, discountPercentage, minimumPrice, expireOn } = req.body;

    if (!name || !discountPercentage || !minimumPrice || !expireOn) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingCoupon = await Coupon.findOne({ name: name.trim().toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }

    const discountPercentageNum = parseFloat(discountPercentage);
    const minimumPriceNum = parseFloat(minimumPrice);
    if (isNaN(discountPercentageNum) || discountPercentageNum <= 0 || discountPercentageNum > 100) {
      return res.status(400).json({ error: 'Discount percentage must be between 0 and 100' });
    }
    if (isNaN(minimumPriceNum) || minimumPriceNum <= 0) {
      return res.status(400).json({ error: 'Minimum purchase must be a positive number' });
    }

    // Validate expiry date
    const expiryDate = new Date(expireOn);
    if (isNaN(expiryDate.getTime()) || expiryDate < new Date()) {
      return res.status(400).json({ error: 'Invalid or past expiry date' });
    }

    // Create new coupon
    const coupon = new Coupon({
      name: name.trim().toUpperCase(),
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
    res.status(500).json({ error: `Server error: ${error.message}` });
  }
};

const editCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const { name, discountPercentage, minimumPrice, expireOn, usageLimit } = req.body;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    // Validate new values
    if (name) {
      const existingCoupon = await Coupon.findOne({ name: name.trim().toUpperCase(), _id: { $ne: couponId } });
      if (existingCoupon) {
        return res.status(400).json({ error: 'Another coupon with this name already exists' });
      }
      coupon.name = name.trim().toUpperCase();
    }

    if (discountPercentage !== undefined) {
      const discountPercentageNum = parseFloat(discountPercentage);
      if (isNaN(discountPercentageNum) || discountPercentageNum <= 0 || discountPercentageNum > 100) {
        return res.status(400).json({ error: 'Discount percentage must be between 0 and 100' });
      }
      coupon.discountPercentage = discountPercentageNum;
    }

    if (minimumPrice !== undefined) {
      const minimumPriceNum = parseFloat(minimumPrice);
      if (isNaN(minimumPriceNum) || minimumPriceNum <= 0) {
        return res.status(400).json({ error: 'Minimum purchase must be a positive number' });
      }
      coupon.minimumPrice = minimumPriceNum;
    }

    if (expireOn) {
      const expiryDate = new Date(expireOn);
      if (isNaN(expiryDate.getTime()) || expiryDate < new Date()) {
        return res.status(400).json({ error: 'Invalid or past expiry date' });
      }
      coupon.expireOn = expiryDate;
    }

    if (usageLimit !== undefined) {
      const usageLimitNum = parseInt(usageLimit);
      if (isNaN(usageLimitNum) || usageLimitNum < 1) {
        return res.status(400).json({ error: 'Usage limit must be at least 1' });
      }
      coupon.usageLimit = usageLimitNum;
    }

    await coupon.save();
    res.json({ success: true, message: 'Coupon updated successfully', coupon });
  } catch (error) {
    console.error('Error editing coupon:', error);
    res.status(500).json({ error: `Server error: ${error.message}` });
  }
};


const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const { islist } = req.body;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(400).json({ error: 'Coupon not found' });
    }

    coupon.islist = islist;
    await coupon.save();

    res.json({ 
      success: true, 
      message: islist ? 'Coupon restored successfully' : 'Coupon deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting/restoring coupon:', error);
    res.status(500).json({ error: 'Server error while deleting/restoring coupon' });
  }
};

module.exports = {
  getCouponPage,
  createCoupon,
  deleteCoupon,
  editCoupon,
};    