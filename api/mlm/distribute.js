const Order = require("../order/model");
const Product = require("../product/model/model");
const Service = require("../service/model/model");
const User = require("../user/model/model");
const WalletTransaction = require("../wallet/model");
const {
  ADMIN_SHARE_OF_PROFIT,
  MLM_SHARE_OF_PROFIT,
  MLM_UPLINE_SLOTS,
} = require("./constants");
const { getAncestorChain, findDefaultAdminRecipient } = require("./referral");
const { MAX_COMMISSION_HOPS } = require("./constants");

const UPDATE_OPTS = { returnDocument: "after" };

const roundMoney = (n) => {
  const value = Number(n);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
};

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
    "meta.superseded": { $ne: true },
  };
  if (meta.productId) query["meta.productId"] = meta.productId;
  if (meta.serviceId) query["meta.serviceId"] = meta.serviceId;
  const rows = await WalletTransaction.find(query).select("_id meta");
  return rows.some((row) => !row.meta?.superseded);
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
 * Any member's order: up to 6 upline hops earn 30/20/20/10/10/10.
 * Hop 7+ upline exits (no payout). Depth 7+ from head is org level 6.
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

  const buyer = await User.findById(order.user).select("_id name email referralCode orgLevel");
  if (!buyer) throw new Error("Buyer not found");

  const upline = await getAncestorChain(buyer._id, MAX_COMMISSION_HOPS);
  const adminUser = await findDefaultAdminRecipient();

  const slotRecipients = MLM_UPLINE_SLOTS.map(({ slot, hop, label, rate }) => ({
    slot,
    hop,
    label,
    rate,
    recipient: upline[hop - 1] || null,
  }));

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

    for (const { slot, rate, label, recipient } of slotRecipients) {
      const share = roundMoney(mlmPool * rate);
      if (share <= 0) continue;

      const targetId = recipient?._id;

      if (targetId) {
        const result = await creditWalletOnce(targetId, share, {
          type: "mlm_commission",
          mlmLevel: slot,
          orderId: order._id,
          description: `MLM ${label} — ${typeLabel}: ${line.title}`,
          meta: buildLineMeta(line, lineProfit, qty, rate),
        });
        if (!result.skipped) creditsApplied += 1;
      } else if (adminRecipient) {
        const result = await creditWalletOnce(adminRecipient, share, {
          type: "unallocated",
          mlmLevel: slot,
          orderId: order._id,
          description: `Company wallet — unallocated ${label} — ${typeLabel}: ${line.title}`,
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
    buyer: { id: buyer._id, name: buyer.name, orgLevel: buyer.orgLevel },
    uplineCount: upline.length,
    effectiveHead: upline[MAX_COMMISSION_HOPS - 1]
      ? {
          id: upline[MAX_COMMISSION_HOPS - 1]._id,
          name: upline[MAX_COMMISSION_HOPS - 1].name,
          hop: MAX_COMMISSION_HOPS,
        }
      : null,
    exitedUplineCount: Math.max(0, (await getFullUplineCount(buyer._id)) - MAX_COMMISSION_HOPS),
  };
};

const getFullUplineCount = async (buyerId) => {
  const full = await getAncestorChain(buyerId, 64);
  return full.length;
};

module.exports = {
  distributeOrderCommissions,
  creditWallet,
  roundMoney,
  orderHasCommissionableItems,
};
