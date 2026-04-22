 const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },

  quantity: {
    type: Number,
    default: 1,
    min: 1,
  },

  price: Number, // price when added to cart
  priceAfterDiscount: Number,
  totalProductDiscount: Number,
});

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one cart per user
    },

    cartItems: [cartItemSchema],

    totalPrice: {
      type: Number,
      default: 0,
    },

    totalPriceAfterDiscount: {
      type: Number,
      default: 0,
    },

    discount: {
      type: Number,
      default: 0,
    },

    couponCode: String,

    couponDiscount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

//
// 🔄 Auto populate product details
//
cartSchema.pre(["find", "findOne"], function () {
  this.populate(
    "cartItems.productId",
    "title imgCover price priceAfterDiscount quantity"
  );
});

//
// 🧮 Calculate totals method
//
cartSchema.methods.calculateTotals = function () {
  let totalPrice = 0;
  let totalDiscount = 0;

  this.cartItems.forEach((item) => {
    totalPrice += item.price * item.quantity;

    if (item.priceAfterDiscount) {
      totalDiscount +=
        (item.price - item.priceAfterDiscount) * item.quantity;
    }
  });

  this.totalPrice = totalPrice;
  this.discount = totalDiscount;
  this.totalPriceAfterDiscount =
    totalPrice - totalDiscount - this.couponDiscount;
};

module.exports = mongoose.model("Cart", cartSchema);
