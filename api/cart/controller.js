const {
    getUserCartService,
    addToCartService,
    removeFromCartService,
    applyCouponToCartService,
    removeCouponFromCartService,
    clearCartService,
} = require("../cart/services");

const getCart = async (req, res) => {
    try {
        const cart = await getUserCartService(req.user.id);
        res.status(200).json({ success: true, data: cart });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const addToCart = async (req, res) => {
    try {
        const cart = await addToCartService(req.user.id, req.body);
        res.status(200).json({
           success: true,
           message: "Item added to cart successfully",
           data: cart, 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const removeFromCart = async (req, res) => {
    try {
        const cart = await removeFromCartService(
            req.user.id,
            req.params.productId
        );
        res.status(200).json({
            success: true,
            message: "Item removed",
            data: cart,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const clearCart = async (req, res) => {
    try {
        await clearCartService(req.user.id);
        res.status(200).json({
            success: true,
            message: "Cart cleared",
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const applyCoupon = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({
                success: false,
                message: "Coupon code is required",
            });
        }
        const cart = await applyCouponToCartService(req.user.id, code);
        res.status(200).json({
            success: true,
            message: "Coupon applied",
            data: cart,
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const removeCoupon = async (req, res) => {
    try {
        const cart = await removeCouponFromCartService(req.user.id);
        res.status(200).json({
            success: true,
            message: "Coupon removed",
            data: cart,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getCart,
    addToCart,
    removeFromCart,
    applyCoupon,
    removeCoupon,
    clearCart,
};