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

    showInNav: {
      type: Boolean,
      default: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("category", categorySchema);
