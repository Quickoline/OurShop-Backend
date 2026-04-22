const Coupon = require("../coupon/model");


const createCouponService = async (data) => {
    return await Coupon.create(data);
};


const getAllCouponsService = async () => {
    return await Coupon.find()
    .populate("applicableCategories")
    .populate("applicableProducts")
    .sort("-createdAt");
};


const getActiveCouponsService = async () => {
    const now = new Date();
    return await Coupon.find({
        isActive: true,
        validFrom: { $lte: now },
        expires: { $gte: now },
    })
    .populate("applicableCategories")
    .populate("applicableProducts")
    .sort("-createdAt");
};


const getCouponByIdService = async (id) => {
    return await Coupon.findById(id)
    .populate("applicableCategories")
    .populate("applicableProducts");
};


const getCouponByCodeService = async (code) => {
 return await Coupon.findOne({ code: code.toUpperCase() })
 .populate("applicableCategories")
 .populate("applicableProducts");
};


const validateCouponService = async (code, userId, orderTotal, isNewUser) => {
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) return { valid: false, message: "Coupon not found" };


    const userUsageCount = coupon.usedBy.filter(
        (entry) => entry.userId?.toString() === userId?.toString()
    ).length;

    if (userUsageCount >= coupon.usageLimitPerUser) {
        return { valid: false, message: "You have already used this coupon" };
    }


    const validation = coupon.isValid(userId, orderTotal, isNewUser);
    if (!validation.valid) return validation;

    const discount = coupon.calculateDiscount(orderTotal);
    return { valid: true, coupon, discount };
};


const applyCouponService = async (couponId, userId, orderId) => {
    return await Coupon.findByIdAndUpdate(
        couponId,
        {
            $inc: { usedCount: 1 },
            $push: { usedBy: { userId, orderId, usedAt: new Date() } },
        },
        { new: true }
    );
};


const  updateCouponService = async (id, data) => {
    return await Coupon.findByIdAndUpdate(id, data, { new: true });
};


const deleteCouponService = async (id) => {
    return await Coupon.findByIdAndDelete(id);
};

module.exports = {
    createCouponService,
    getAllCouponsService,
    getActiveCouponsService,
    getCouponByIdService,
    getCouponByCodeService,
    validateCouponService,
    applyCouponService,
    updateCouponService,
    deleteCouponService,
};