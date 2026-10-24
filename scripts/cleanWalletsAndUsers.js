/**
 * Audit, log, and clean wallet + referral data.
 * - Lists orphan wallet txns (user id not in users collection)
 * - Removes orphan txns and broken sponsor refs
 * - Resets all wallet balances to 0 and deletes all wallet transactions
 *
 * Usage:
 *   node scripts/cleanWalletsAndUsers.js           # audit only (dry run)
 *   node scripts/cleanWalletsAndUsers.js --apply   # execute cleanup
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../api/user/model/model");
const WalletTransaction = require("../api/wallet/model");
const Order = require("../api/order/model");
const { roundMoney } = require("../api/mlm/distribute");

const APPLY = process.argv.includes("--apply");
const LOG_DIR = path.join(__dirname, "../logs");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");

const logLines = [];
const log = (line = "") => {
  const text = String(line);
  console.log(text);
  logLines.push(text);
};

const saveLog = () => {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  const file = path.join(LOG_DIR, `wallet-cleanup-${STAMP}.log`);
  fs.writeFileSync(file, logLines.join("\n") + "\n");
  log(`\nLog saved: ${file}`);
};

const getUserIdSet = async () => {
  const rows = await User.find({}).select("_id");
  return new Set(rows.map((u) => String(u._id)));
};

const audit = async (userIds) => {
  log("=== WALLET & USER AUDIT ===\n");

  const users = await User.find({})
    .select("name email role walletBalance referralCode sponsor orgLevel blocked isActive createdAt")
    .sort({ role: 1, email: 1 })
    .lean();

  log(`Users in database: ${users.length}`);
  log(`Wallet transactions: ${await WalletTransaction.countDocuments()}`);
  log(`Orders: ${await Order.countDocuments()}\n`);

  const txnUserIds = await WalletTransaction.distinct("user");
  const orphanTxnUserIds = txnUserIds.filter((id) => !userIds.has(String(id)));

  log(`--- Orphan wallet records (user NOT in database) ---`);
  if (!orphanTxnUserIds.length) {
    log("  None found.");
  } else {
    for (const id of orphanTxnUserIds) {
      const stats = await WalletTransaction.aggregate([
        { $match: { user: id } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } },
      ]);
      const row = stats[0] || { count: 0, total: 0 };
      log(`  ${id} | txns: ${row.count} | sum: ₹${roundMoney(row.total)}`);
    }
  }

  const badSponsorUsers = users.filter(
    (u) => u.sponsor && !userIds.has(String(u.sponsor))
  );
  log(`\n--- Users with missing sponsor (broken referral) ---`);
  if (!badSponsorUsers.length) {
    log("  None found.");
  } else {
    for (const u of badSponsorUsers) {
      log(`  ${u.email} | sponsor id: ${u.sponsor}`);
    }
  }

  const orphanSponsorTargets = [
    ...new Set(users.map((u) => String(u.sponsor)).filter((id) => id && id !== "null")),
  ].filter((id) => !userIds.has(id));
  log(`\n--- Referral targets missing from users collection ---`);
  if (!orphanSponsorTargets.length) log("  None found.");
  else orphanSponsorTargets.forEach((id) => log(`  ${id}`));

  const orders = await Order.find({}).select("user invoiceNumber commissionDistributed").lean();
  const orphanOrderUsers = [
    ...new Set(orders.map((o) => String(o.user)).filter((id) => !userIds.has(id))),
  ];
  log(`\n--- Orders referencing missing users ---`);
  if (!orphanOrderUsers.length) log("  None found.");
  else orphanOrderUsers.forEach((id) => log(`  ${id}`));

  log(`\n--- Users with wallet activity ---`);
  const txnByUser = await WalletTransaction.aggregate([
    { $group: { _id: "$user", count: { $sum: 1 }, total: { $sum: "$amount" } } },
    { $sort: { count: -1 } },
  ]);
  for (const row of txnByUser) {
    const u = users.find((x) => String(x._id) === String(row._id));
    if (!u) {
      log(`  [ORPHAN] ${row._id} | txns: ${row.count} | sum: ₹${roundMoney(row.total)}`);
      continue;
    }
    if (row.count > 0 || u.walletBalance) {
      log(
        `  ${u.email} | balance: ₹${u.walletBalance} | txn sum: ₹${roundMoney(row.total)} | txns: ${row.count}`
      );
    }
  }

  log(`\n--- All users ---`);
  for (const u of users) {
    const sponsorOk = !u.sponsor || userIds.has(String(u.sponsor));
    log(
      `  ${u.role.padEnd(5)} | ${u.email} | ₹${u.walletBalance} | ${u.referralCode || "—"} | L${u.orgLevel ?? "?"} | sponsor: ${u.sponsor ? (sponsorOk ? "ok" : "MISSING") : "—"}`
    );
  }

  return { orphanTxnUserIds, badSponsorUsers, orphanOrderUsers };
};

const applyCleanup = async ({ orphanTxnUserIds, badSponsorUsers }) => {
  log("\n=== APPLYING CLEANUP ===\n");

  if (orphanTxnUserIds.length) {
    const del = await WalletTransaction.deleteMany({
      user: { $in: orphanTxnUserIds },
    });
    log(`Deleted orphan wallet transactions: ${del.deletedCount}`);
  } else {
    log("No orphan wallet transactions to delete.");
  }

  if (badSponsorUsers.length) {
    for (const u of badSponsorUsers) {
      await User.findByIdAndUpdate(u._id, { $set: { sponsor: null } });
      log(`Cleared broken sponsor for ${u.email}`);
    }
  }

  const txnDel = await WalletTransaction.deleteMany({});
  log(`Deleted all wallet transactions: ${txnDel.deletedCount}`);

  const walletReset = await User.updateMany({}, { $set: { walletBalance: 0 } });
  log(`Reset wallet balances: ${walletReset.modifiedCount} user(s)`);

  const orderReset = await Order.updateMany(
    {},
    {
      $set: {
        commissionDistributed: false,
        mlmProfitTotal: 0,
        adminProfitShare: 0,
        mlmProfitShare: 0,
      },
    }
  );
  log(`Reset order MLM flags: ${orderReset.modifiedCount} order(s)`);

  log("\nCleanup complete. Users and referral codes kept; wallets zeroed.");
};

const run = async () => {
  await connectDB();
  const userIds = await getUserIdSet();
  const auditResult = await audit(userIds);

  if (!APPLY) {
    log("\nDry run only. Re-run with --apply to execute cleanup.");
  } else {
    await applyCleanup(auditResult);
    log("\n--- Post-cleanup ---");
    await audit(await getUserIdSet());
  }

  saveLog();
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
