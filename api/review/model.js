const mongoose = require("mongoose");
const { Schema } = mongoose;

const reviewSchema = new Schema(
    {
        title: {
            type: String,
            trim: true,
        },
        text: {
            type: String,
            trim: true,
            required: [true, "Please add some text"],
        },
        productId: {
            type: Schema.ObjectId,
            ref: "Product",
            required: [true, "Product Id is required"],
        },
        userId: {
            type: Schema.ObjectId,
            ref: "User",
            required: [true, "User ID is required"],
        },
        rate: {
            type: Number,
            default: 1,
            min: [1, "Rating must be at least 1"],
            max: [5, "Rating cannot exceed 5"],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);


reviewSchema.pre(["find", "findOne"], function () {
    this.populate("userId", "name");
    this.populate("productId", "title slug");
});

module.exports = mongoose.model("review", reviewSchema);