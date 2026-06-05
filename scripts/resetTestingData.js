/**
 * Clear orders, wallet balances, and MLM distribution history for manual testing.
 * Keeps users, products, services, and catalog intact.
 *
 * Usage: node scripts/resetTestingData.js
 */
require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../api/user/model/model");
const Order = require("../api/order/model");
const WalletTransaction = require("../api/wallet/model");
const Cart = require("../api/cart/model");
const Wishlist = require("../api/wishlist/model");

const run = async () => {
  await connectDB();

  const [txnResult, orderResult, cartResult, wishlistResult, walletResult] =
    await Promise.all([
      WalletTransaction.deleteMany({}),
      Order.deleteMany({}),
      Cart.deleteMany({}),
      Wishlist.deleteMany({}),
      User.updateMany({}, { $set: { walletBalance: 0 } }),
    ]);

  const users = await User.find()
    .select("name email role walletBalance referralCode")
    .sort({ role: 1, email: 1 })
    .lean();

  console.log("=== Testing data reset complete ===\n");
  console.log(`Wallet transactions deleted: ${txnResult.deletedCount}`);
  console.log(`Orders deleted: ${orderResult.deletedCount}`);
  console.log(`Carts cleared: ${cartResult.deletedCount}`);
  console.log(`Wishlists cleared: ${wishlistResult.deletedCount}`);
  console.log(`Wallet balances reset: ${walletResult.modifiedCount} user(s)\n`);

  console.log("Accounts (all wallets ₹0):");
  users.forEach((u) => {
    console.log(
      `  ${u.role.padEnd(5)} | ${u.email} | ${u.referralCode || "—"} | ₹${u.walletBalance}`
    );
  });

  console.log("\nYou can now place orders manually and mark DELIVERED to test MLM.");
  console.log("Logins unchanged (e.g. admin@shop.com, rahul@shop.com, priya@shop.com).");

  const mongoose = require("mongoose");
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error("Reset failed:", err.message);
  process.exit(1);
});
