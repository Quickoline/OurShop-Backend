const express = require("express");
const { authenticate } = require("../../auth/auth");
const {
      createReview,
    getAllReviews,
    getActiveReviews,
    getReviewsByProductId,
    getReviewsByUserId,
    getReviewById,
    updateReview,
    deleteReview,
} = require("../review/controller");

const router = express.Router();

router.post("/", authenticate, createReview);
router.get("/", getAllReviews);
router.get("/active", getActiveReviews);
router.get("/product/:productId", getReviewsByProductId);
router.get("/user/:userId", getReviewsByUserId);
router.get("/:id", getReviewById);
router.put("/:id", authenticate, updateReview);
router.delete("/:id", authenticate, deleteReview);

module.exports = router;

