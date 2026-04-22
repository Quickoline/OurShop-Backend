const mongoose = require("mongoose");
const { Schema } = mongoose;

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      minlength: [2, "Too Short"],
      unique: true,
      trim: true,
    },

    slug: {
      type: String,
      lowercase: true,
      unique: true,
    },

    description: {
      type: String,
      trim: true,
    },

    image: {
      type: String,
    },

    icon: {
      type: String, // Menu icon
    },

    // Parent category for nested structure
    parentCategory: {
      type: Schema.ObjectId,
      ref: "category",
      default: null,
    },

    // Sorting order
    displayOrder: {
      type: Number,
      default: 0,
    },

    // Show in navbar
    showInNav: {
      type: Boolean,
      default: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // SEO
    metaTitle: String,
    metaDescription: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);


// 🔗 Virtual for subcategories
categorySchema.virtual("subcategories", {
  ref: "category",
  localField: "_id",
  foreignField: "parentCategory",
});


// 🖼️ Add full image URL automatically
categorySchema.post("init", function (doc) {
  if (doc.image) {
    doc.image = `${process.env.BASE_URL}category/${doc.image}`;
  }
});


// 🚀 Export model
module.exports = mongoose.model("category", categorySchema);