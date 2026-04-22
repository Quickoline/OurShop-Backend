const express = require("express");
const {
     getWishlist,
    addToWishlist,
    removeFromWishlist,
    clearWishlist,
} = require("../wishlist/controller");

const { authenticate } = require("../../auth/auth");

const router = express.Router();

router.get("/", authenticate, getWishlist);
router.post("/", authenticate, addToWishlist);
router.delete("/:productId", authenticate, removeFromWishlist);
router.delete("/", authenticate, clearWishlist);

module.exports = router;
