const Order = require("../order/model");
const Product = require("../product/model/model");
const Service = require("../service/model/model");
const User = require("../user/model/model");
const WalletTransaction = require("../wallet/model");
const {
  ADMIN_SHARE_OF_PROFIT,
  MLM_SHARE_OF_PROFIT,
  MLM_LEVEL_RATES,
} = require("./constants");
const { getAncestorChain, findDefaultAdminRecipient } = require("./referral");

const UPDATE_OPTS = { returnDocument: "after" };

const roundMoney = (n) => Math.round(Number(n) * 100) / 100;

const creditWallet = async (userId, amount, payload) => {
  const amt = roundMoney(amount);
  if (amt <= 0) return null;

  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { walletBalance: amt } },
    UPDATE_OPTS
  );
  if (!updated) return null;

  return WalletTransaction.create({
    user: userId,
    amount: amt,
    type: payload.type,
    mlmLevel: payload.mlmLevel ?? null,
    order: payload.orderId,
    description: payload.description,
    balanceAfter: roundMoney(updated.walletBalance || 0),
    meta: payload.meta || {},
  });
};

const payoutExists = async (orderId, userId, payload) => {
  const meta = payload.meta || {};
  const query = {
    order: orderId,
    user: userId,
    type: payload.type,
    mlmLevel: payload.mlmLevel ?? null,
  };
  if (meta.productId) query["meta.productId"] = meta.productId;
  if (meta.serviceId) query["meta.serviceId"] = meta.serviceId;
  return WalletTransaction.exists(query);
};

const creditWalletOnce = async (userId, amount, payload) => {
  if (await payoutExists(payload.orderId, userId, payload)) {
    return { skipped: true };
  }
  const txn = await creditWallet(userId, amount, payload);
  return { skipped: false, txn };
};

const isServiceLine = (item) =>
  item.itemType === "service" || Boolean(item.service);

const isProductLine = (item) =>
  item.itemType === "product" || Boolean(item.product);

const orderHasCommissionableItems = (order) =>
  Array.isArray(order.orderItems) &&
  order.orderItems.some((item) => isProductLine(item) || isServiceLine(item));

const resolveCommissionLine = async (item) => {
  if (isServiceLine(item)) {
    const service =
      item.service?.profitAmount !== undefined
        ? item.service
        : await Service.findById(item.service).select("profitAmount title");
    return {
      itemType: "service",
      title: item.title || service?.title || "service",
      catalogId: item.service?._id || item.service,
      profitPerUnit: Number(item.profitAmount ?? service?.profitAmount ?? 0),
    };
  }

  if (isProductLine(item)) {
    const product =
      item.product?.profitAmount !== undefined
        ? item.product
        : await Product.findById(item.product).select("profitAmount title");
    return {
      itemType: "product",
      title: item.title || product?.title || "product",
      catalogId: item.product?._id || item.product,
      profitPerUnit: Number(item.profitAmount ?? product?.profitAmount ?? 0),
    };
  }

  return null;
};

const buildLineMeta = (line, lineProfit, qty, rate) => ({
  itemType: line.itemType,
  profitBase: lineProfit,
  rate,
  quantity: qty,
  ...(line.itemType === "service"
    ? { serviceId: line.catalogId }
    : { productId: line.catalogId }),
});

/**
 * MLM pool (50% of line profit) on each delivered order — upline only:
 * - head (10%): buyer (Rahul when Rahul orders)
 * - level1–6: sponsor chain upward only; missing slots → company wallet
 * Downline (buyer's referrals) never earn on the buyer's order.
 */
const distributeOrderCommissions = async (orderId) => {
  const order = await Order.findById(orderId)
    .populate("orderItems.product", "profitAmount title")
    .populate("orderItems.service", "profitAmount title");

  if (!order) throw new Error("Order not found");
  if (order.orderStatus !== "DELIVERED") {
    throw new Error("Order must be delivered before MLM commissions run");
  }
  if (!orderHasCommissionableItems(order)) {
    return { skipped: true, reason: "no_commissionable_items" };
  }

  const buyer = await User.findById(order.user).select("_id name email referralCode");
  if (!buyer) throw new Error("Buyer not found");

  const upline = await getAncestorChain(buyer._id, 6);
  const adminUser = await findDefaultAdminRecipient();

  const levelRecipients = {
    head: buyer,
    level1: upline[0] || null,
    level2: upline[1] || null,
    level3: upline[2] || null,
    level4: upline[3] || null,
    level5: upline[4] || null,
    level6: upline[5] || null,
  };

  let totalProfit = 0;
  let totalAdminShare = 0;
  let totalMlmShare = 0;
  let creditsApplied = 0;

  for (let i = 0; i < order.orderItems.length; i += 1) {
    const item = order.orderItems[i];
    const line = await resolveCommissionLine(item);
    if (!line || line.profitPerUnit <= 0) continue;

    const qty = Number(item.quantity || 1);
    const lineProfit = roundMoney(line.profitPerUnit * qty);
    totalProfit += lineProfit;

    const adminPool = roundMoney(lineProfit * ADMIN_SHARE_OF_PROFIT);
    const mlmPool = roundMoney(lineProfit * MLM_SHARE_OF_PROFIT);
    totalAdminShare += adminPool;
    totalMlmShare += mlmPool;

    const typeLabel = line.itemType === "service" ? "Service" : "Product";
    const adminRecipient = adminUser?._id;

    if (adminRecipient && adminPool > 0) {
      const adminResult = await creditWalletOnce(adminRecipient, adminPool, {
        type: "admin_share",
        mlmLevel: null,
        orderId: order._id,
        description: `Admin share (${typeLabel}: ${line.title})`,
        meta: buildLineMeta(line, lineProfit, qty, ADMIN_SHARE_OF_PROFIT),
      });
      if (!adminResult.skipped) creditsApplied += 1;
    }

    for (const [levelKey, rate] of Object.entries(MLM_LEVEL_RATES)) {
      const share = roundMoney(mlmPool * rate);
      if (share <= 0) continue;

      const recipient = levelRecipients[levelKey];
      const targetId = recipient?._id;

      if (targetId) {
        const result = await creditWalletOnce(targetId, share, {
          type: "mlm_commission",
          mlmLevel: levelKey,
          orderId: order._id,
          description: `MLM ${levelKey} (${levelKey === "head" ? "buyer" : "upline"}) — ${typeLabel}: ${line.title}`,
          meta: buildLineMeta(line, lineProfit, qty, rate),
        });
        if (!result.skipped) creditsApplied += 1;
      } else if (adminRecipient) {
        const result = await creditWalletOnce(adminRecipient, share, {
          type: "unallocated",
          mlmLevel: levelKey,
          orderId: order._id,
          description: `Company wallet — unallocated ${levelKey} (no upline) — ${typeLabel}: ${line.title}`,
          meta: buildLineMeta(line, lineProfit, qty, rate),
        });
        if (!result.skipped) {
          creditsApplied += 1;
          totalAdminShare += share;
        }
      }
    }
  }

  if (totalProfit <= 0) {
    return { skipped: true, reason: "no_catalog_profit" };
  }

  if (creditsApplied === 0 && order.commissionDistributed) {
    return { skipped: true, reason: "already_distributed", buyer: { id: buyer._id, name: buyer.name } };
  }

  await Order.findByIdAndUpdate(
    orderId,
    {
      $set: {
        commissionDistributed: true,
        mlmProfitTotal: roundMoney(totalProfit),
        adminProfitShare: roundMoney(totalAdminShare),
        mlmProfitShare: roundMoney(totalMlmShare),
      },
    },
    UPDATE_OPTS
  );

  return {
    distributed: true,
    creditsApplied,
    totalProfit: roundMoney(totalProfit),
    adminShare: roundMoney(totalAdminShare),
    mlmShare: roundMoney(totalMlmShare),
    buyer: { id: buyer._id, name: buyer.name },
    uplineCount: upline.length,
  };
};

module.exports = {
  distributeOrderCommissions,
  creditWallet,
  roundMoney,
  orderHasCommissionableItems,
};
