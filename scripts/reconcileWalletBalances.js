/**
 * Set each user walletBalance to the sum of their wallet transactions.
 * Usage: node scripts/reconcileWalletBalances.js
 */
require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../api/user/model/model");
const WalletTransaction = require("../api/wallet/model");
const { roundMoney } = require("../api/mlm/distribute");

const run = async () => {
  await connectDB();
  const users = await User.find({}).select("_id email walletBalance role");
  let fixed = 0;

  for (const user of users) {
    const rows = await WalletTransaction.aggregate([
      { $match: { user: user._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const computed = roundMoney(Math.max(0, rows[0]?.total || 0));
    const current = roundMoney(user.walletBalance || 0);
    if (computed !== current) {
      await User.findByIdAndUpdate(user._id, { $set: { walletBalance: computed } });
      console.log(`${user.email} (${user.role}): ${current} → ${computed}`);
      fixed += 1;
    }
  }

  console.log(`Done. Reconciled ${fixed} wallet(s).`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
