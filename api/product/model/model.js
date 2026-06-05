const mongoose = require("mongoose");
const { Schema } = mongoose;

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: [3, "Too Short product Name"],
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    imgCover: {
      type: String,
    },
    images: {
      type: [String],
    },
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
    /** Per-unit profit used for MLM distribution (50% admin / 50% upline) */
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
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    sold: {
      type: Number,
      default: 0,
      min: 0,
    },
    unit: {
      type: String,
      enum: [
        "kg",
        "g",
        "l",
        "ml",
        "pcs",
        "box",
        "bag",
        "bottle",
        "pack",
        "set",
        "other",
      ],
      default: "pcs",
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "category",
      required: true,
    },
    subcategory: {
      type: Schema.Types.ObjectId,
      ref: "category",
      required: true,
    },
    brand: {
      type: Schema.Types.ObjectId,
      ref: "brand",
      required: true,
    },
    tags: [
      {
        type: String,
        enum: ["bestseller", "newly_launched", "mega_offer", "combo", "gift"],
      },
    ],
    isBestSeller: {
      type: Boolean,
      default: false,
    },
    isNewlyLaunched: {
      type: Boolean,
      default: false,
    },
    isMegaOffer: {
      type: Boolean,
      default: false,
    },
    isCombo: {
      type: Boolean,
      default: false,
    },
    ratingAvg: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    ratingCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    metaTitle: String,
    metaDescription: String,

    isActive: {
      type: Boolean,
      default: true,
    },
    benefits: [String],
    ingredients: [String],
    howToUse: String,
    soldBy: String,
    useBy: Date,
    aboutItems: [String],
    specifications: [
      {
        group: { type: String, default: "General" },
        key: String,
        value: String,
      },
    ],
    sizeOptions: [
      {
        label: String,
        price: Number,
        mrp: Number,
        perUnitPrice: Number,
        savingsPercent: Number,
        isDefault: { type: Boolean, default: false },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

productSchema.pre("save", function () {
  if (this.price && this.priceAfterDiscount) {
    this.discountPercentage = Math.round(
      ((this.price - this.priceAfterDiscount) / this.price) * 100
    );
  }
});

/* ====== IMAGE URL FORMAT ====== */
productSchema.post("init", function (doc) {
  if (doc.imgCover && !String(doc.imgCover).startsWith("http")) {
    doc.imgCover = `${process.env.BASE_URL}products/${doc.imgCover}`;
  }
  if (Array.isArray(doc.images) && doc.images.length) {
    doc.images = doc.images.map((img) =>
      String(img).startsWith("http") ? img : `${process.env.BASE_URL}products/${img}`
    );
  }
});

/* ====== VIRTUAL POPULATE ====== */
productSchema.virtual("reviews", {
  ref: "review",
  localField: "_id",
  foreignField: "productId",
});

productSchema.index({ title: "text", description: "text"});
productSchema.index({ category: 1, subcategory: 1 });
productSchema.index({ isBestSeller: 1 });
productSchema.index({ isNewlyLaunched: 1 });

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
