const express = require("express");
const { authenticate, authorizeRoles } = require("../../auth/auth");
const {
    createCoupon,
    getAllCoupons,
    getActiveCoupons,
    getCouponById,
    getCouponByCode,
    validateCoupon,
    applyCoupon,
    updateCoupon,
    deleteCoupon,
} = require("../coupon/controller");

const router = express.Router();

router.post("/", authenticate, authorizeRoles("admin"), createCoupon);
router.get("/", getAllCoupons);
router.get("/active", getActiveCoupons);
router.get("/code/:code", getCouponByCode);
router.get("/:id", getCouponById);
router.post("/validate", authenticate, validateCoupon);
router.post("/apply", authenticate, applyCoupon);
router.put("/:id", authenticate, authorizeRoles("admin"), updateCoupon);
router.delete("/:id", authenticate, authorizeRoles("admin"), deleteCoupon);

module.exports = router;
