/**
 * Reverse buyer "head" / self MLM credits (upline-only rule).
 * Recovered amounts go to the company wallet.
 * Usage: node scripts/reverseHeadPayouts.js
 */
require("dotenv").config();
const connectDB = require("../config/db");
const Order = require("../api/order/model");
const User = require("../api/user/model/model");
const WalletTransaction = require("../api/wallet/model");
const { findDefaultAdminRecipient } = require("../api/mlm/referral");
const { roundMoney } = require("../api/mlm/distribute");

const reversalExists = async (txn) =>
  WalletTransaction.exists({ "meta.reversedTxn": txn._id });

const reverseTxn = async (txn, admin) => {
  if (await reversalExists(txn)) return false;

  const amt = roundMoney(txn.amount);
  if (amt <= 0) return false;

  const user = await User.findById(txn.user);
  if (!user) return false;

  const newUserBal = roundMoney(Math.max(0, (user.walletBalance || 0) - amt));
  await User.findByIdAndUpdate(txn.user, { $set: { walletBalance: newUserBal } });

  await WalletTransaction.create({
    user: txn.user,
    amount: -amt,
    type: "admin_adjustment",
    order: txn.order,
    mlmLevel: txn.mlmLevel,
    description: "Reversal: buyer head/self MLM (upline-only rule)",
    balanceAfter: newUserBal,
    meta: { reversedTxn: txn._id, reason: "no_head_income" },
  });

  const adminDoc = await User.findByIdAndUpdate(
    admin._id,
    { $inc: { walletBalance: amt } },
    { returnDocument: "after" }
  );

  await WalletTransaction.create({
    user: admin._id,
    amount: amt,
    type: "unallocated",
    mlmLevel: txn.mlmLevel === "head" ? "head" : null,
    order: txn.order,
    description: "Company wallet — recovered buyer head/self MLM",
    balanceAfter: roundMoney(adminDoc.walletBalance || 0),
    meta: { reversedTxn: txn._id, reason: "no_head_income" },
  });

  console.log(`Reversed ₹${amt} | order ${txn.order} | ${user.email} | ${txn.mlmLevel || "buyer"}`);
  return true;
};

const run = async () => {
  await connectDB();
  const admin = await findDefaultAdminRecipient();
  if (!admin) throw new Error("No admin user for company wallet");

  const orders = await Order.find({ orderStatus: "DELIVERED" }).select("_id user");
  let count = 0;

  for (const order of orders) {
    const buyerId = String(order.user);
    const txns = await WalletTransaction.find({
      order: order._id,
      type: "mlm_commission",
      $or: [{ mlmLevel: "head" }, { user: order.user }],
    });

    for (const txn of txns) {
      if (String(txn.user) === buyerId || txn.mlmLevel === "head") {
        if (await reverseTxn(txn, admin)) count += 1;
      }
    }
  }

  console.log(`Done. Reversed ${count} head/self payout(s).`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
