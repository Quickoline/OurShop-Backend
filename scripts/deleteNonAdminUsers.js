/**
 * Delete all users except admin(s). Cleans related wallet, orders, carts, wishlists.
 * Usage:
 *   node scripts/deleteNonAdminUsers.js           # dry run
 *   node scripts/deleteNonAdminUsers.js --apply   # execute
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../api/user/model/model");
const WalletTransaction = require("../api/wallet/model");
const Order = require("../api/order/model");
const Cart = require("../api/cart/model");
const Wishlist = require("../api/wishlist/model");

const APPLY = process.argv.includes("--apply");
const LOG_DIR = path.join(__dirname, "../logs");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");
const logLines = [];
const log = (line = "") => {
  console.log(line);
  logLines.push(String(line));
};

const saveLog = () => {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  const file = path.join(LOG_DIR, `delete-users-${STAMP}.log`);
  fs.writeFileSync(file, logLines.join("\n") + "\n");
  log(`\nLog saved: ${file}`);
};

const run = async () => {
  await connectDB();

  const admins = await User.find({ role: "admin" }).select("email name").lean();
  const toDelete = await User.find({ role: { $ne: "admin" } })
    .select("name email referralCode role")
    .sort({ email: 1 })
    .lean();

  const ids = toDelete.map((u) => u._id);

  log("=== DELETE NON-ADMIN USERS ===\n");
  log(`Keeping ${admins.length} admin(s):`);
  admins.forEach((a) => log(`  ${a.email}`));
  log(`\nWill delete ${toDelete.length} user(s):`);
  toDelete.forEach((u) => log(`  ${u.email} | ${u.referralCode || "—"}`));

  if (!ids.length) {
    log("\nNothing to delete.");
    saveLog();
    await mongoose.disconnect();
    return;
  }

  const [txnCount, orderCount, cartCount, wishCount] = await Promise.all([
    WalletTransaction.countDocuments({ user: { $in: ids } }),
    Order.countDocuments({ user: { $in: ids } }),
    Cart.countDocuments({ user: { $in: ids } }),
    Wishlist.countDocuments({ user: { $in: ids } }),
  ]);

  log(`\nRelated records: wallet txns ${txnCount}, orders ${orderCount}, carts ${cartCount}, wishlists ${wishCount}`);

  if (!APPLY) {
    log("\nDry run. Re-run with --apply to delete.");
    saveLog();
    await mongoose.disconnect();
    return;
  }

  const [txnDel, orderDel, cartDel, wishDel, userDel] = await Promise.all([
    WalletTransaction.deleteMany({ user: { $in: ids } }),
    Order.deleteMany({ user: { $in: ids } }),
    Cart.deleteMany({ user: { $in: ids } }),
    Wishlist.deleteMany({ user: { $in: ids } }),
    User.deleteMany({ _id: { $in: ids } }),
  ]);

  log("\n=== DELETED ===");
  log(`Users: ${userDel.deletedCount}`);
  log(`Wallet transactions: ${txnDel.deletedCount}`);
  log(`Orders: ${orderDel.deletedCount}`);
  log(`Carts: ${cartDel.deletedCount}`);
  log(`Wishlists: ${wishDel.deletedCount}`);

  const remaining = await User.countDocuments();
  log(`\nUsers remaining: ${remaining}`);

  saveLog();
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
