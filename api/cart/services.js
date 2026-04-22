const Cart = require("../cart/model");
const Product = require("../product/model/model");
const { getCouponByCodeService, validateCouponService } = require("../coupon/services");

const resolveCartProductId = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value.toString === "function" && value.constructor?.name === "ObjectId") {
        return value.toString();
    }
    if (value._id) return resolveCartProductId(value._id);
    return String(value);
};

const getUserCartService = async (userId) => {
    return await Cart.findOne({ userId }).populate("cartItems.productId");
}; 

const addToCartService = async (userId, productData) => {
    const { productId, quantity = 1 } = productData;
    const product = await Product.findById(productId);
    if (!product) {
        throw new Error("Product not found");
    }
    if (product.isActive === false) {
        throw new Error("This product is inactive");
    }

    const safeQuantity = Number(quantity) > 0 ? Number(quantity) : 1;
    const itemPayload = {
        productId: product._id,
        quantity: safeQuantity,
        price: product.price,
        priceAfterDiscount: product.priceAfterDiscount || product.price,
    };

    let cart = await Cart.findOne({ userId });

    if (!cart) {
        cart = new Cart({
            userId,
            cartItems: [itemPayload],
        });
        cart.calculateTotals();
        await cart.save();
        return cart;
    }

    const itemIndex = cart.cartItems.findIndex(
        (item) =>
            resolveCartProductId(item.productId) === productId.toString()
    );

   if (itemIndex > -1) {
        const nextQty = cart.cartItems[itemIndex].quantity + safeQuantity;
        if (nextQty > Number(product.quantity || 0)) {
            throw new Error("Product is out of stock for requested quantity");
        }
        cart.cartItems[itemIndex].quantity = nextQty;
   } else {
        if (safeQuantity > Number(product.quantity || 0)) {
            throw new Error("Product is out of stock for requested quantity");
        }
        cart.cartItems.push(itemPayload);
   }

   cart.calculateTotals();
   if (cart.couponCode) {
        try {
            const couponValidation = await validateCouponService(
                cart.couponCode,
                userId,
                cart.totalPrice,
                false
            );
            cart.couponDiscount = couponValidation.valid ? couponValidation.discount : 0;
        } catch {
            cart.couponDiscount = 0;
        }
        cart.calculateTotals();
   }
   await cart.save();
   return cart;
};

const removeFromCartService = async (userId, productId) => {
    const cart = await Cart.findOne({ userId });

    if (!cart) return null;

    cart.cartItems = cart.cartItems.filter(
        (item) => resolveCartProductId(item.productId) !== productId.toString()
    );

    cart.calculateTotals();
    if (cart.couponCode) {
        try {
            const couponValidation = await validateCouponService(
                cart.couponCode,
                userId,
                cart.totalPrice,
                false
            );
            cart.couponDiscount = couponValidation.valid ? couponValidation.discount : 0;
        } catch {
            cart.couponDiscount = 0;
        }
        cart.calculateTotals();
    }
    await cart.save();
    return cart;
};

const applyCouponToCartService = async (userId, code) => {
    const cart = await Cart.findOne({ userId });
    if (!cart || cart.cartItems.length === 0) {
        throw new Error("Cart is empty");
    }

    const coupon = await getCouponByCodeService(code);
    if (!coupon) throw new Error("Coupon not found");

    const validation = await validateCouponService(code, userId, cart.totalPrice, false);
    if (!validation.valid) {
        throw new Error(validation.message || "Coupon is not valid");
    }

    cart.couponCode = coupon.code;
    cart.couponDiscount = validation.discount;
    cart.calculateTotals();
    await cart.save();
    return cart;
};

const removeCouponFromCartService = async (userId) => {
    const cart = await Cart.findOne({ userId });
    if (!cart) return null;
    cart.couponCode = undefined;
    cart.couponDiscount = 0;
    cart.calculateTotals();
    await cart.save();
    return cart;
};

const clearCartService = async (userId) => {
    return await Cart.findOneAndDelete({ userId });
};

module.exports = {
    getUserCartService,
    addToCartService,
    removeFromCartService,
    applyCouponToCartService,
    removeCouponFromCartService,
    clearCartService,
};