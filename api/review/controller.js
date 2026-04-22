const {
     createReviewService,
    getAllReviewsService,
    getActiveReviewsService,
    getReviewsByProductIdService,
    getReviewsByUserIdService,
    getReviewByIdService,
    updateReviewService,
    deleteReviewService,
} = require("../review/services");


const createReview = async (req, res) => {
    try {
        const payload = {
            ...req.body,
            userId: req.user.id,
        };
        const review = await createReviewService(payload);
        res.status(201).json({
            success: true,
            message: "Review created successfully",
            data: review,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const getAllReviews = async (req, res) => {
    try {
        const reviews = await getAllReviewsService();
        res.status(200).json({ success: true, data: reviews });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });   
    }
};


const getActiveReviews = async (req, res) => {
    try {
        const reviews = await getActiveReviewsService();
        res.status(200).json({ success: true, data: reviews });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const getReviewsByProductId = async (req, res) => {
    try {
        const reviews = await getReviewsByProductIdService(req.params.productId);
        res.status(200).json({ success: true, data: reviews });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const getReviewsByUserId = async (req, res) => {
    try {
        const reviews = await getReviewsByUserIdService(req.params.userId);
        res.status(200).json({ success: true, data: reviews });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const getReviewById = async (req, res) => {
    try {
        const review = await getReviewByIdService(req.params.id);
        if (!review) {
            return res 
            .status(404)
            .json({ success: false, message: "Review not found" });
        }
        res.status(200).json({ success: true, data: review });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const updateReview = async (req, res) => {
    try {
        const current = await getReviewByIdService(req.params.id);
        if (!current) {
            return res
            .status(404)
            .json({ success: false, message: "Review not found" });
        }

        if (
            req.user.role !== "admin" &&
            String(current.userId?._id || current.userId) !== String(req.user.id)
        ) {
            return res.status(403).json({
                success: false,
                message: "You can only update your own review",
            });
        }

        const review = await updateReviewService(req.params.id, req.body);
        res.status(200).json({
            success: true,
            message: "Review updated successfully",
            data: review,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const deleteReview = async (req, res) => {
 try {
    const current = await getReviewByIdService(req.params.id);
    if (!current) {
        return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    }
    if (
        req.user.role !== "admin" &&
        String(current.userId?._id || current.userId) !== String(req.user.id)
    ) {
        return res.status(403).json({
            success: false,
            message: "You can only delete your own review",
        });
    }

    await deleteReviewService(req.params.id);
    res.status(200).json({
        success: true,
        message: "Review deleted succcessfully"
    });
 } catch (error) {
    res.status(500).json({ success: false, message: error.message });
 }
};

module.exports = {
    createReview,
    getAllReviews,
    getActiveReviews,
    getReviewsByProductId,
    getReviewsByUserId,
    getReviewById,
    updateReview,
    deleteReview,
};
