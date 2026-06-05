const mongoose = require("mongoose");
const { Schema } = mongoose;

const serviceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: [3, "Too short service name"],
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    imgCover: { type: String },
    images: { type: [String] },
    description: {
      type: String,
      maxlength: [5000, "Description should be less than or equal to 5000"],
      minlength: [10, "Description should be more than or equal to 10"],
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    priceAfterDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Per-unit profit for MLM (50% admin / 50% upline), same as products */
    profitAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    /** Bookable slots (0 = unlimited) */
    capacity: {
      type: Number,
      default: 0,
      min: 0,
    },
    booked: {
      type: Number,
      default: 0,
      min: 0,
    },
    duration: {
      type: String,
      trim: true,
    },
    unit: {
      type: String,
      enum: ["session", "hour", "visit", "package", "other"],
      default: "session",
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "category",
      required: true,
    },
    subcategory: {
      type: Schema.Types.ObjectId,
      ref: "category",
    },
    brand: {
      type: Schema.Types.ObjectId,
      ref: "brand",
    },
    tags: [
      {
        type: String,
        enum: ["featured", "bestseller", "newly_launched", "mega_offer", "combo", "gift"],
      },
    ],
    isBestSeller: { type: Boolean, default: false },
    isNewlyLaunched: { type: Boolean, default: false },
    isMegaOffer: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    isCombo: { type: Boolean, default: false },
    ratingAvg: { type: Number, min: 0, max: 5, default: 0 },
    ratingCount: { type: Number, min: 0, default: 0 },
    metaTitle: String,
    metaDescription: String,
    isActive: { type: Boolean, default: true },
    benefits: [String],
    howToUse: String,
    soldBy: String,
    aboutItems: [String],
    specifications: [
      {
        group: { type: String, default: "General" },
        key: String,
        value: String,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

serviceSchema.pre("save", function () {
  if (this.price && this.priceAfterDiscount) {
    this.discountPercentage = Math.round(
      ((this.price - this.priceAfterDiscount) / this.price) * 100
    );
  }
  if (this.isBestSeller || this.tags?.includes("featured")) {
    this.isFeatured = true;
  }
});

serviceSchema.post("init", function (doc) {
  if (doc.imgCover && !String(doc.imgCover).startsWith("http")) {
    doc.imgCover = `${process.env.BASE_URL}services/${doc.imgCover}`;
  }
  if (Array.isArray(doc.images) && doc.images.length) {
    doc.images = doc.images.map((img) =>
      String(img).startsWith("http") ? img : `${process.env.BASE_URL}services/${img}`
    );
  }
});

serviceSchema.index({ title: "text", description: "text" });
serviceSchema.index({ category: 1, subcategory: 1 });
serviceSchema.index({ isFeatured: 1 });
serviceSchema.index({ isBestSeller: 1 });

const Service = mongoose.model("Service", serviceSchema);
module.exports = Service;
