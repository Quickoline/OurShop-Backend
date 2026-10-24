/**
 * Old orders paid level4 at 10% of MLM pool (head had 10%).
 * Upline-only rule: level4 should be 20% — credit the missing 10% per line.
 * Usage: node scripts/topupLevel4Mlm.js
 */
require("dotenv").config();
const connectDB = require("../config/db");
const Order = require("../api/order/model");
const User = require("../api/user/model/model");
const WalletTransaction = require("../api/wallet/model");
const { getAncestorChain, findDefaultAdminRecipient } = require("../api/mlm/referral");
const { roundMoney } = require("../api/mlm/distribute");

const LEVEL4_TOPUP_RATE = 0.1;
const TOPUP_META_REASON = "level4_upline_topup";

const creditTopup = async (userId, amount, payload) => {
  const exists = await WalletTransaction.exists({
    order: payload.orderId,
    user: userId,
    type: "mlm_commission",
    mlmLevel: "level4",
    "meta.reason": TOPUP_META_REASON,
    ...(payload.meta.productId ? { "meta.productId": payload.meta.productId } : {}),
    ...(payload.meta.serviceId ? { "meta.serviceId": payload.meta.serviceId } : {}),
  });
  if (exists) return false;

  const amt = roundMoney(amount);
  if (amt <= 0) return false;

  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { walletBalance: amt } },
    { returnDocument: "after" }
  );
  if (!updated) return false;

  await WalletTransaction.create({
    user: userId,
    amount: amt,
    type: "mlm_commission",
    mlmLevel: "level4",
    order: payload.orderId,
    description: payload.description,
    balanceAfter: roundMoney(updated.walletBalance || 0),
    meta: { ...payload.meta, reason: TOPUP_META_REASON },
  });
  return true;
};

const run = async () => {
  await connectDB();
  const admin = await findDefaultAdminRecipient();
  const orders = await Order.find({ orderStatus: "DELIVERED" }).select("_id user orderItems");
  let count = 0;

  for (const order of orders) {
    const upline = await getAncestorChain(order.user, 6);
    const level4User = upline[3] || null;

    for (const item of order.orderItems || []) {
      const profitPerUnit = Number(item.profitAmount || 0);
      if (profitPerUnit <= 0) continue;

      const qty = Number(item.quantity || 1);
      const lineProfit = roundMoney(profitPerUnit * qty);
      const mlmPool = roundMoney(lineProfit * 0.5);
      const topup = roundMoney(mlmPool * LEVEL4_TOPUP_RATE);
      if (topup <= 0) continue;

      const isService = item.itemType === "service" || Boolean(item.service);
      const catalogId = isService ? item.service : item.product;
      const title = item.title || (isService ? "service" : "product");
      const meta = {
        itemType: isService ? "service" : "product",
        profitBase: lineProfit,
        rate: LEVEL4_TOPUP_RATE,
        quantity: qty,
        ...(isService ? { serviceId: catalogId } : { productId: catalogId }),
      };

      const payload = {
        orderId: order._id,
        description: `MLM level4 top-up (upline rate fix) — ${title}`,
        meta,
      };

      if (level4User) {
        if (await creditTopup(level4User._id, topup, payload)) {
          count += 1;
          console.log(`Credited ₹${topup} level4 | order ${order._id} | ${level4User.email}`);
        }
      } else if (admin) {
        const exists = await WalletTransaction.exists({
          order: order._id,
          user: admin._id,
          type: "unallocated",
          mlmLevel: "level4",
          "meta.reason": TOPUP_META_REASON,
          ...(meta.productId ? { "meta.productId": meta.productId } : {}),
          ...(meta.serviceId ? { "meta.serviceId": meta.serviceId } : {}),
        });
        if (!exists) {
          const updated = await User.findByIdAndUpdate(
            admin._id,
            { $inc: { walletBalance: topup } },
            { returnDocument: "after" }
          );
          await WalletTransaction.create({
            user: admin._id,
            amount: topup,
            type: "unallocated",
            mlmLevel: "level4",
            order: order._id,
            description: `Company wallet — unallocated level4 top-up (no upline) — ${title}`,
            balanceAfter: roundMoney(updated.walletBalance || 0),
            meta: { ...meta, reason: TOPUP_META_REASON },
          });
          count += 1;
          console.log(`Credited ₹${topup} company level4 top-up | order ${order._id}`);
        }
      }
    }
  }

  console.log(`Done. Applied ${count} level4 top-up(s).`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
