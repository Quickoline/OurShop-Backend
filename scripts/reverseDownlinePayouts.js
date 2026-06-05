/**
 * Reverse incorrect "direct referral" (downline) MLM credits.
 * Usage: node scripts/reverseDownlinePayouts.js
 */
require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../api/user/model/model");
const WalletTransaction = require("../api/wallet/model");
const { findDefaultAdminRecipient } = require("../api/mlm/referral");
const { roundMoney } = require("../api/mlm/distribute");

const run = async () => {
  await connectDB();
  const admin = await findDefaultAdminRecipient();
  if (!admin) throw new Error("No admin user for company wallet");

  const badTxns = await WalletTransaction.find({
    type: "mlm_commission",
    description: { $regex: /direct referral/i },
  }).sort({ createdAt: 1 });

  console.log(`Found ${badTxns.length} downline payout(s) to reverse.`);

  let reversed = 0;
  for (const txn of badTxns) {
    const amt = roundMoney(txn.amount);
    if (amt <= 0) continue;

    const user = await User.findById(txn.user);
    if (!user) continue;

    const newUserBal = roundMoney(Math.max(0, (user.walletBalance || 0) - amt));
    await User.findByIdAndUpdate(txn.user, { $set: { walletBalance: newUserBal } });

    await WalletTransaction.create({
      user: txn.user,
      amount: -amt,
      type: "admin_adjustment",
      order: txn.order,
      description: `Reversal: incorrect downline MLM (${txn.mlmLevel})`,
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
      description: `Recovered from incorrect downline payout`,
      balanceAfter: roundMoney(adminDoc.walletBalance || 0),
      meta: { reversedTxn: txn._id },
    });

    reversed += 1;
    console.log(`Reversed ₹${amt} from ${user.email} → company`);
  }

  console.log(`Done. Reversed ${reversed} transaction(s).`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
