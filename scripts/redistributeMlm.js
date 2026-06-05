/**
 * Apply / repair MLM for all DELIVERED orders (idempotent — only missing payouts).
 * Usage: node scripts/redistributeMlm.js
 */
require("dotenv").config();
const connectDB = require("../config/db");
const Order = require("../api/order/model");
const { distributeOrderCommissions } = require("../api/mlm/distribute");

const run = async () => {
  await connectDB();
  const pending = await Order.find({ orderStatus: "DELIVERED" }).select(
    "_id invoiceNumber commissionDistributed"
  );

  console.log(`Processing ${pending.length} delivered order(s).`);

  for (const order of pending) {
    try {
      const result = await distributeOrderCommissions(order._id);
      console.log(order.invoiceNumber || order._id, result);
    } catch (err) {
      console.error(order.invoiceNumber || order._id, err.message);
    }
  }

  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
