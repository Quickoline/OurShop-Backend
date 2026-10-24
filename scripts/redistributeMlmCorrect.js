/**
 * Reverse all MLM / unallocated payouts on delivered orders and re-apply
 * org-tree slots: buyer=L6, sponsor=L5 (30%) … head (10%).
 * Usage: node scripts/redistributeMlmCorrect.js
 */
require("dotenv").config();
const connectDB = require("../config/db");
const Order = require("../api/order/model");
const User = require("../api/user/model/model");
const WalletTransaction = require("../api/wallet/model");
const { findDefaultAdminRecipient } = require("../api/mlm/referral");
const { distributeOrderCommissions, roundMoney } = require("../api/mlm/distribute");

const reversalExists = async (txn) =>
  WalletTransaction.exists({ "meta.reversedTxn": txn._id });

const reverseTxn = async (txn, admin) => {
  if (txn.meta?.superseded) return false;
  if (await reversalExists(txn)) {
    await WalletTransaction.findByIdAndUpdate(txn._id, {
      $set: { "meta.superseded": true },
    });
    return false;
  }

  const amt = roundMoney(txn.amount);
  if (amt <= 0) return false;

  const user = await User.findById(txn.user);
  if (!user) return false;

  const newBal = roundMoney(Math.max(0, (user.walletBalance || 0) - amt));
  await User.findByIdAndUpdate(txn.user, { $set: { walletBalance: newBal } });

  await WalletTransaction.create({
    user: txn.user,
    amount: -amt,
    type: "admin_adjustment",
    order: txn.order,
    mlmLevel: txn.mlmLevel,
    description: `Reversal: MLM redistribute (${txn.type} ${txn.mlmLevel || "-"})`,
    balanceAfter: newBal,
    meta: { reversedTxn: txn._id, reason: "mlm_redistribute" },
  });

  if (txn.type === "unallocated" && admin) {
    const adminBal = roundMoney(Math.max(0, (admin.walletBalance || 0) - amt));
    await User.findByIdAndUpdate(admin._id, { $set: { walletBalance: adminBal } });
    await WalletTransaction.create({
      user: admin._id,
      amount: -amt,
      type: "admin_adjustment",
      order: txn.order,
      mlmLevel: txn.mlmLevel,
      description: `Reversal: company unallocated MLM (${txn.mlmLevel || "-"})`,
      balanceAfter: adminBal,
      meta: { reversedTxn: txn._id, reason: "mlm_redistribute" },
    });
  }

  await WalletTransaction.findByIdAndUpdate(txn._id, {
    $set: { "meta.superseded": true },
  });
  return true;
};

const run = async () => {
  await connectDB();
  const admin = await findDefaultAdminRecipient();
  const deliveredIds = await Order.find({ orderStatus: "DELIVERED" }).distinct("_id");
  const txnOrderIds = await WalletTransaction.distinct("order", {
    order: { $exists: true, $ne: null },
    type: { $in: ["mlm_commission", "unallocated"] },
    "meta.superseded": { $ne: true },
  });
  const orderIdSet = new Set([
    ...deliveredIds.map(String),
    ...txnOrderIds.map(String),
  ]);
  const orders = await Order.find({
    _id: { $in: [...orderIdSet] },
    orderStatus: "DELIVERED",
  }).select("_id invoiceNumber");
  let reversed = 0;
  let redistributed = 0;

  for (const order of orders) {
    const txns = await WalletTransaction.find({
      order: order._id,
      type: { $in: ["mlm_commission", "unallocated"] },
      "meta.superseded": { $ne: true },
    });

    for (const txn of txns) {
      if (await reverseTxn(txn, admin)) reversed += 1;
    }

    await Order.findByIdAndUpdate(order._id, {
      $set: { commissionDistributed: false },
    });

    try {
      const result = await distributeOrderCommissions(order._id);
      console.log(order.invoiceNumber || order._id, result);
      if (result.distributed) redistributed += 1;
    } catch (err) {
      console.error(order.invoiceNumber || order._id, err.message);
    }
  }

  console.log(`Done. Reversed ${reversed} txn(s), redistributed ${redistributed} order(s).`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
