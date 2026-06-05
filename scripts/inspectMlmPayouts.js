require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../api/user/model/model");
const Order = require("../api/order/model");
const WalletTransaction = require("../api/wallet/model");

const run = async () => {
  await connectDB();

  const users = await User.find({ role: "user" })
    .select("name email referralCode sponsor walletBalance")
    .populate("sponsor", "name referralCode")
    .lean();

  console.log("=== USERS ===");
  users.forEach((u) => {
    console.log(
      `${u.email} | wallet: ${u.walletBalance} | sponsor: ${u.sponsor?.name || "none"}`
    );
  });

  const admin = await User.findOne({ role: "admin" }).select("email walletBalance");
  console.log(`\nADMIN ${admin?.email} | wallet: ${admin?.walletBalance}`);

  const orders = await Order.find({ orderStatus: "DELIVERED" })
    .populate("user", "email name")
    .sort({ createdAt: -1 })
    .lean();

  console.log("\n=== DELIVERED ORDER PAYOUTS (mlm + unallocated) ===");
  for (const o of orders.slice(0, 5)) {
    console.log(`\nBuyer: ${o.user?.email}`);
    const txns = await WalletTransaction.find({
      order: o._id,
      type: { $in: ["mlm_commission", "unallocated"] },
    })
      .populate("user", "email")
      .sort({ mlmLevel: 1 })
      .lean();
    txns.forEach((t) => {
      console.log(`  ${t.type} | ${t.mlmLevel || "-"} | ${t.user?.email} | +${t.amount}`);
    });
  }

  const mongoose = require("mongoose");
  await mongoose.disconnect();
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
