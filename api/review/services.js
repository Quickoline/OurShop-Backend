const Review = require("../review/model");
const Product = require("../product/model/model");

const recalculateProductRating = async (productId) => {
    const stats = await Review.aggregate([
        { $match: { productId, isActive: true } },
        {
            $group: {
                _id: "$productId",
                ratingAvg: { $avg: "$rate" },
                ratingCount: { $sum: 1 },
            },
        },
    ]);

    const ratingAvg = stats[0]?.ratingAvg || 0;
    const ratingCount = stats[0]?.ratingCount || 0;

    await Product.findByIdAndUpdate(productId, {
        ratingAvg: Number(ratingAvg.toFixed(1)),
        ratingCount,
    });
};


const createReviewService = async (data) => {
    const existing = await Review.findOne({
        productId: data.productId,
        userId: data.userId,
    });
    if (existing) {
        throw new Error("You have already reviewed this product");
    }

    const created = await Review.create(data);
    await recalculateProductRating(created.productId);
    return created;
};


const getAllReviewsService = async () => {
    return await Review.find().sort({ createdAt: -1 });
};


const getActiveReviewsService = async () => {
    return await Review.find({ isActive: true }).sort({ createdAt: -1 });
};


const getReviewsByProductIdService = async (productId) => {
    return await Review.find({ productId, isActive: true }).sort({
     createdAt: -1
     });
};


const getReviewsByUserIdService = async (userId) => {
    return await Review.find({ userId }).sort({ createdAt: -1 });
};


const getReviewByIdService = async (id) => {
    return await Review.findById(id);
};


const updateReviewService = async (id, data) => {
    const updated = await Review.findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true,
    });
    if (updated) {
        await recalculateProductRating(updated.productId);
    }
    return updated;
};


const deleteReviewService = async (id) => {
    const deleted = await Review.findByIdAndDelete(id);
    if (deleted) {
        await recalculateProductRating(deleted.productId);
    }
    return deleted;
};

module.exports = {
    createReviewService,
    getAllReviewsService,
    getActiveReviewsService,
    getReviewsByProductIdService,
    getReviewsByUserIdService,
    getReviewByIdService,
    updateReviewService,
    deleteReviewService,
};