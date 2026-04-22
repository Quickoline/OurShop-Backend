const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      uppercase: true,
    },

    description: {
      type: String,
      trim: true,
    },

    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },

    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },

    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxDiscount: {
      type: Number,
      min: 0,
    },

    // Usage restrictions
    isNewUserOnly: {
      type: Boolean,
      default: false,
    },

    usageLimit: {
      type: Number,
      default: null,
    },

    usedCount: {
      type: Number,
      default: 0,
    },

    usageLimitPerUser: {
      type: Number,
      default: 1,
    },

    usedBy: [
      {
        userId: { type: Schema.ObjectId, ref: "User" },
        usedAt: { type: Date, default: Date.now },
        orderId: { type: Schema.ObjectId, ref: "Order" },
      },
    ],

    // Validity
    validFrom: {
      type: Date,
      default: Date.now,
    },

    expires: {
      type: Date,
      required: true,
    },

    // Applicable scope
    applicableCategories: [{ type: Schema.ObjectId, ref: "category" }],
    applicableProducts: [{ type: Schema.ObjectId, ref: "Product" }],

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);



// ✅ Check if coupon is valid
couponSchema.methods.isValid = function (userId, orderTotal, isNewUser) {
  const now = new Date();

  if (this.expires < now)
    return { valid: false, message: "Coupon expired" };

  if (this.validFrom > now)
    return { valid: false, message: "Coupon not yet active" };

  if (!this.isActive)
    return { valid: false, message: "Coupon is inactive" };

  if (orderTotal < this.minOrderValue) {
    return {
      valid: false,
      message: `Minimum order value of ₹${this.minOrderValue} required`,
    };
  }

  if (this.isNewUserOnly && !isNewUser) {
    return { valid: false, message: "This coupon is for new users only" };
  }

  if (this.usageLimit && this.usedCount >= this.usageLimit) {
    return { valid: false, message: "Coupon usage limit reached" };
  }

  return { valid: true };
};



// ✅ Calculate discount
couponSchema.methods.calculateDiscount = function (orderTotal) {
  let discount = 0;

  if (this.discountType === "percentage") {
    discount = (orderTotal * this.discountValue) / 100;

    if (this.maxDiscount && discount > this.maxDiscount) {
      discount = this.maxDiscount;
    }
  } else {
    discount = this.discountValue;
  }

  return Math.min(discount, orderTotal);
};



// 🚀 Export model
module.exports = mongoose.model("coupon", couponSchema);