const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "mlm_commission",
        "admin_share",
        "admin_adjustment",
        "withdrawal",
        "refund",
        "unallocated",
      ],
      required: true,
    },
    mlmLevel: {
      type: String,
      enum: ["head", "level1", "level2", "level3", "level4", "level5", "level6", null],
      default: null,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    description: String,
    balanceAfter: {
      type: Number,
      default: 0,
    },
    meta: {
      itemType: { type: String, enum: ["product", "service"] },
      productId: mongoose.Schema.Types.ObjectId,
      serviceId: mongoose.Schema.Types.ObjectId,
      profitBase: Number,
      rate: Number,
      quantity: Number,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WalletTransaction", walletTransactionSchema);
