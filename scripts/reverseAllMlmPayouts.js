/**
 * Reverse every active MLM / unallocated wallet txn (for orders missing or not delivered).
 * Usage: node scripts/reverseAllMlmPayouts.js
 */
require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../api/user/model/model");
const WalletTransaction = require("../api/wallet/model");
const { findDefaultAdminRecipient } = require("../api/mlm/referral");
const { roundMoney } = require("../api/mlm/distribute");

const reversalExists = async (txn) =>
  WalletTransaction.exists({ "meta.reversedTxn": txn._id });

const reverseTxn = async (txn, admin) => {
  if (await reversalExists(txn)) {
    if (!txn.meta?.superseded) {
      await WalletTransaction.findByIdAndUpdate(txn._id, { $set: { "meta.superseded": true } });
    }
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
    description: `Reversal: MLM cleanup (${txn.type} ${txn.mlmLevel || "-"})`,
    balanceAfter: newBal,
    meta: { reversedTxn: txn._id, reason: "mlm_cleanup" },
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
      meta: { reversedTxn: txn._id, reason: "mlm_cleanup" },
    });
  }

  await WalletTransaction.findByIdAndUpdate(txn._id, { $set: { "meta.superseded": true } });
  console.log(`Reversed ₹${amt} | ${txn.type} ${txn.mlmLevel} | ${user.email}`);
  return true;
};

const run = async () => {
  await connectDB();
  const admin = await findDefaultAdminRecipient();
  const txns = await WalletTransaction.find({
    type: { $in: ["mlm_commission", "unallocated"] },
    amount: { $gt: 0 },
  });

  let count = 0;
  for (const txn of txns) {
    if (await reverseTxn(txn, admin)) count += 1;
  }

  console.log(`Done. Reversed ${count} MLM payout(s).`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
