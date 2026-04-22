const mongoose = require("mongoose");
const { Schema } = mongoose;

const wishlistSchema = new Schema(
  {
    userId: {
      type: Schema.ObjectId,
      ref: "User",
      required: true,
    },

    products: [
      {
        productId: {
          type: Schema.ObjectId,
          ref: "Product",
          required: true,
        },

        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);


// Ensure one wishlist per user
wishlistSchema.index({ userId: 1 }, { unique: true });


// Auto populate product details
wishlistSchema.pre(["find", "findOne"], function () {
  this.populate("products.productId");
});


// Export model
module.exports = mongoose.model("wishlist", wishlistSchema);