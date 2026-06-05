/**
 * Reverse MLM credits paid to non-upline recipients (downline / wrong level1).
 * Idempotent: skips txns already listed in meta.reversedTxn.
 * Usage: node scripts/repairInvalidMlmPayouts.js
 */
require("dotenv").config();
const connectDB = require("../config/db");
const Order = require("../api/order/model");
const User = require("../api/user/model/model");
const WalletTransaction = require("../api/wallet/model");
const { getAncestorChain, findDefaultAdminRecipient } = require("../api/mlm/referral");
const { roundMoney } = require("../api/mlm/distribute");

const alreadyReversed = async () => {
  const rows = await WalletTransaction.find({
    type: "admin_adjustment",
    "meta.reversedTxn": { $exists: true },
  }).select("meta.reversedTxn");
  return new Set(rows.map((r) => String(r.meta.reversedTxn)));
};

const validRecipientIds = async (buyerId) => {
  const buyer = await User.findById(buyerId).select("_id");
  const upline = await getAncestorChain(buyerId, 6);
  const map = { head: [String(buyer._id)] };
  for (let i = 1; i <= 6; i += 1) {
    map[`level${i}`] = upline[i - 1] ? [String(upline[i - 1]._id)] : [];
  }
  return map;
};

const reverseTxn = async (txn, admin, reversedSet) => {
  if (reversedSet.has(String(txn._id))) return false;

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
    description: `Reversal: invalid MLM ${txn.mlmLevel} (upline-only rule)`,
    balanceAfter: newUserBal,
    meta: { reversedTxn: txn._id },
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
    mlmLevel: txn.mlmLevel,
    order: txn.order,
    description: `Company wallet — recovered invalid MLM ${txn.mlmLevel}`,
    balanceAfter: roundMoney(adminDoc.walletBalance || 0),
    meta: { reversedTxn: txn._id },
  });

  reversedSet.add(String(txn._id));
  console.log(
    `Reversed ₹${amt} | order ${txn.order} | ${txn.mlmLevel} | ${user.email}`
  );
  return true;
};

const run = async () => {
  await connectDB();
  const admin = await findDefaultAdminRecipient();
  if (!admin) throw new Error("No admin user");

  const reversedSet = await alreadyReversed();
  const orders = await Order.find({ orderStatus: "DELIVERED" }).select("_id user");
  let count = 0;

  for (const order of orders) {
    const valid = await validRecipientIds(order.user);
    const txns = await WalletTransaction.find({
      order: order._id,
      type: "mlm_commission",
    });

    for (const txn of txns) {
      const level = txn.mlmLevel;
      if (!level || !valid[level]) continue;
      const allowed = valid[level];
      if (!allowed.includes(String(txn.user))) {
        if (await reverseTxn(txn, admin, reversedSet)) count += 1;
      }
    }
  }

  console.log(`Done. Reversed ${count} invalid payout(s).`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
