const Cart = require("../cart/model");
const Product = require("../product/model/model");
const Service = require("../service/model/model");
const { getCouponByCodeService, validateCouponService } = require("../coupon/services");

const resolveCartRefId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.toString === "function" && value.constructor?.name === "ObjectId") {
    return value.toString();
  }
  if (value._id) return resolveCartRefId(value._id);
  return String(value);
};

const mapCartItemToCatalog = (item) => {
  if (!item) return null;
  if (item.itemType === "service" || item.serviceId) {
    const service = item.serviceId;
    if (!service) return null;
    return { ...service.toObject?.() ? service.toObject() : service, catalogType: "service" };
  }
  const product = item.productId;
  if (!product) return null;
  return { ...product.toObject?.() ? product.toObject() : product, catalogType: "product" };
};

const getUserCartService = async (userId) => {
  return await Cart.findOne({ userId });
};

const addToCartService = async (userId, payload) => {
  const {
    productId,
    serviceId,
    itemType = productId ? "product" : serviceId ? "service" : "product",
    quantity = 1,
  } = payload;

  const safeQuantity = Number(quantity) > 0 ? Number(quantity) : 1;
  let itemPayload;

  if (itemType === "service" || serviceId) {
    const service = await Service.findById(serviceId || productId);
    if (!service) throw new Error("Service not found");
    if (service.isActive === false) throw new Error("This service is inactive");

    const capacity = Number(service.capacity || 0);
    if (capacity > 0 && safeQuantity > capacity) {
      throw new Error("Service has no available slots for requested quantity");
    }

    itemPayload = {
      itemType: "service",
      serviceId: service._id,
      quantity: safeQuantity,
      price: service.price,
      priceAfterDiscount: service.priceAfterDiscount || service.price,
    };
  } else {
    const product = await Product.findById(productId);
    if (!product) throw new Error("Product not found");
    if (product.isActive === false) throw new Error("This product is inactive");

    if (safeQuantity > Number(product.quantity || 0)) {
      throw new Error("Product is out of stock for requested quantity");
    }

    itemPayload = {
      itemType: "product",
      productId: product._id,
      quantity: safeQuantity,
      price: product.price,
      priceAfterDiscount: product.priceAfterDiscount || product.price,
    };
  }

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

  const refKey = itemPayload.itemType === "service" ? "serviceId" : "productId";
  const refValue = itemPayload[refKey].toString();

  const itemIndex = cart.cartItems.findIndex((item) => {
    const existingRef =
      item.itemType === "service"
        ? resolveCartRefId(item.serviceId)
        : resolveCartRefId(item.productId);
    return existingRef === refValue;
  });

  if (itemIndex > -1) {
    const nextQty = cart.cartItems[itemIndex].quantity + safeQuantity;

    if (itemPayload.itemType === "service") {
      const service = await Service.findById(refValue);
      const capacity = Number(service?.capacity || 0);
      if (capacity > 0 && nextQty > capacity) {
        throw new Error("Service has no available slots for requested quantity");
      }
    } else {
      const product = await Product.findById(refValue);
      if (nextQty > Number(product?.quantity || 0)) {
        throw new Error("Product is out of stock for requested quantity");
      }
    }

    cart.cartItems[itemIndex].quantity = nextQty;
  } else {
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

const removeFromCartService = async (userId, itemId) => {
  const cart = await Cart.findOne({ userId });
  if (!cart) return null;

  cart.cartItems = cart.cartItems.filter((item) => {
    const pid = resolveCartRefId(item.productId);
    const sid = resolveCartRefId(item.serviceId);
    return pid !== itemId.toString() && sid !== itemId.toString();
  });

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
  mapCartItemToCatalog,
};
