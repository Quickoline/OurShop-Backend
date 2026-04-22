const {
      createCouponService,
    getAllCouponsService,
    getActiveCouponsService,
    getCouponByIdService,
    getCouponByCodeService,
    validateCouponService,
    applyCouponService,
    updateCouponService,
    deleteCouponService,
} = require("../coupon/services");


const createCoupon = async (req, res) => {
    try {
        const coupon = await createCouponService(req.body);
        res.status(201).json({
            success: true,
            message: "Coupon created successfully",
            data: coupon,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const getAllCoupons = async (req, res) => {
    try {
        const coupons = await getAllCouponsService();
        res.status(200).json({ success: true, data: coupons });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const getActiveCoupons = async (req, res) => {
    try {
        const coupons = await getActiveCouponsService();
        res.status(200).json({ success: true, data: coupons });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const getCouponById = async (req, res) => {
    try {
        const coupon = await getCouponByIdService(req.params.id);
        if (!coupon) {
            return res
            .status(404)
            .json({ success: false, message: "Coupon not found" });
        }
        res.status(200).json({ success: true, data: coupon });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const getCouponByCode = async (req, res) => {
    try {
        const coupon = await getCouponByCodeService(req.params.code);
        if (!coupon) {
            return res
            .status(404)
            .json({ success: false, message: "Coupon not found" });
        }
        res.status(200).json({ success: true, data: coupon });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const validateCoupon = async (req, res ) => {
    try {
        const { code, orderTotal, isNewUser } = req.body;
        const userId = req.user?.id;
        const result = await validateCouponService(
            code,
            userId,
            orderTotal,
            isNewUser
        );

        if (!result.valid) {
            return res.status(400).json({ success: false, message: result.message });
        }

        res.status(200).json({
         success: true,
         message: "Coupon is valid",
         data: {
            coupon: result.coupon,
            discount: result.discount,
         },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const applyCoupon = async (req, res) => {
    try {
        const { couponId, orderId } = req.body;
        const userId = req.user?.id;
        if (!couponId || !orderId) {
            return res.status(400).json({
                success: false,
                message: "couponId and orderId are required",
            });
        }
        const coupon = await applyCouponService(couponId, userId, orderId);
        if (!coupon) {
            return res
            .status(404)
            .json({ success: false, message: "Coupon not found or already applied" });
        }
        res.status(200).json({ 
        success: true,
        message: "Coupon applied successfully",
        data: coupon, 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const updateCoupon = async (req, res) => {
    try {
        const coupon = await updateCouponService(req.params.id, req.body);
        if (!coupon) {
            return res
            .status(404)
            .json({ success: false, message: "Coupon not found" });
        }
        res.status(200).json({
            success: true,
            message: "Coupon updated successfully",
            data: coupon,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const deleteCoupon = async (req, res) => {
    try{
        await deleteCouponService(req.params.id);
        res.status(200).json({ 
        success: true,
        message: "Coupon deleted successfuly",
    });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createCoupon,
    getAllCoupons,
    getActiveCoupons,
    getCouponById,
    getCouponByCode,
    validateCoupon,
    applyCoupon,
    updateCoupon,
    deleteCoupon,
};