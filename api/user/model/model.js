const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // hide password
    },

    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,

    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    verified: {
      type: Boolean,
      default: false,
    },

    blocked: {
      type: Boolean,
      default: false,
    },

    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },

    sponsor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    addresses: [
      {
        city: String,
        street: String,
        state: String,
        pincode: String,
        phone: String,
      },
    ],
  },
  { timestamps: true }
);

const { generateReferralCode } = require("../../mlm/code");

// Referral code on new users
userSchema.pre("save", async function () {
  if (this.isNew && !this.referralCode && this.role === "user") {
    let code;
    let exists = true;
    const User = mongoose.model("User");
    while (exists) {
      code = generateReferralCode(this.name);
      exists = await User.exists({ referralCode: code });
    }
    this.referralCode = code;
  }
});

// 🔐 Hash password before save
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 8);
});

// 🔐 Hash password on update
userSchema.pre("findOneAndUpdate", async function () {
  if (this._update.password) {
    this._update.password = await bcrypt.hash(this._update.password, 8);
    this._update.passwordChangedAt = Date.now();
  }
});

// 🔍 Compare password
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Create password reset token (stored hashed in DB, plain returned once)
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 min

  return resetToken;
};

module.exports = mongoose.model("User", userSchema);
