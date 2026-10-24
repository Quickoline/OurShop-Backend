const mongoose = require("mongoose");

const deliveryWalletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const deliveryWalletTransactionSchema = new mongoose.Schema(
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
      enum: ["CREDIT", "DEBIT"],
      required: true,
    },
    balanceAfter: {
      type: Number,
      default: 0,
    },
    description: String,
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
  },
  { timestamps: true }
);

const DeliveryWallet = mongoose.model("DeliveryWallet", deliveryWalletSchema);
const DeliveryWalletTransaction = mongoose.model("DeliveryWalletTransaction", deliveryWalletTransactionSchema);

module.exports = {
  DeliveryWallet,
  DeliveryWalletTransaction,
};
