const express = require("express");
const {
    getCart,
    addToCart,
    removeFromCart,
    applyCoupon,
    removeCoupon,
    clearCart,
} = require("../cart/controller");
const { authenticate } = require("../../auth/auth");

const router = express.Router();

router.get("/", authenticate, getCart);
router.post("/add", authenticate, addToCart);
router.delete("/remove/:productId", authenticate, removeFromCart);
router.post("/apply-coupon", authenticate, applyCoupon);
router.delete("/coupon", authenticate, removeCoupon);
router.delete("/clear", authenticate, clearCart);

module.exports = router;