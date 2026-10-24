const User = require("../user/model/model");
const WalletTransaction = require("./model");
const { DeliveryWallet, DeliveryWalletTransaction } = require("./deliveryWalletModel");
const { creditWallet, roundMoney } = require("../mlm/distribute");
const { MLM_UPLINE_SLOTS, ORG_MAX_LEVEL, MAX_COMMISSION_HOPS } = require("../mlm/constants");
const { findDefaultAdminRecipient } = require("../mlm/referral");
const { getOrgLevel, canRefer, orgLevelLabel } = require("../mlm/orgLevel");
const { resolveAdminListLimit } = require("../../config/adminList");

const slotForHop = (hop) => MLM_UPLINE_SLOTS.find((s) => s.hop === hop);

const getWalletSummary = async (userId) => {
  const user = await User.findById(userId).select(
    "walletBalance referralCode sponsor name email orgLevel role"
  );
  if (!user) return null;

  const orgLevel =
    user.orgLevel !== null && user.orgLevel !== undefined
      ? user.orgLevel
      : await getOrgLevel(userId);

  const sponsor = user.sponsor
    ? await User.findById(user.sponsor).select("name email referralCode orgLevel")
    : null;

  return {
    walletBalance: user.walletBalance || 0,
    referralCode: canRefer(orgLevel) ? user.referralCode : null,
    canRefer: canRefer(orgLevel),
    orgLevel,
    orgLevelLabel: orgLevelLabel(orgLevel),
    sponsor,
    name: user.name,
    email: user.email,
  };
};

const getDeliveryWalletSummary = async (userId) => {
  const user = await User.findById(userId).select("name email role");
  if (!user) return null;

  let wallet = await DeliveryWallet.findOne({ user: userId });
  if (!wallet) {
    wallet = await DeliveryWallet.create({ user: userId, balance: 0 });
  }

  return {
    walletBalance: wallet.balance || 0,
    name: user.name,
    email: user.email,
    role: user.role,
  };
};

const getDeliveryTransactions = async (userId, { page = 1, limit = 20 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);
  const filter = { user: userId };

  const [transactions, total] = await Promise.all([
    DeliveryWalletTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    DeliveryWalletTransaction.countDocuments(filter),
  ]);

  return {
    transactions,
    pagination: {
      currentPage: Number(page),
      totalPages: Math.ceil(total / Number(limit)) || 1,
      total,
    },
  };
};

const getTransactions = async (userId, { page = 1, limit = 20 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);
  const filter = { user: userId };

  const [transactions, total] = await Promise.all([
    WalletTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    WalletTransaction.countDocuments(filter),
  ]);

  return {
    transactions,
    pagination: {
      currentPage: Number(page),
      totalPages: Math.ceil(total / Number(limit)) || 1,
      total,
    },
  };
};

const adminListWallets = async ({ page = 1, limit = 10000, search } = {}) => {
  const filter = { role: "user" };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { referralCode: { $regex: search, $options: "i" } },
    ];
  }

  const pageLimit = resolveAdminListLimit(limit);
  const skip = (Number(page) - 1) * pageLimit;
  const [users, total] = await Promise.all([
    User.find(filter)
      .select("name email referralCode walletBalance sponsor blocked isActive createdAt")
      .populate("sponsor", "name email referralCode")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit),
    User.countDocuments(filter),
  ]);

  return {
    users,
    pagination: {
      currentPage: Number(page),
      totalPages: Math.ceil(total / pageLimit) || 1,
      total,
    },
  };
};

const adminAdjustWallet = async (userId, { amount, description }, adminId) => {
  const amt = roundMoney(amount);
  if (!amt || amt === 0) throw new Error("Amount must be non-zero");

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const newBalance = roundMoney((user.walletBalance || 0) + amt);
  if (newBalance < 0) throw new Error("Wallet balance cannot go below zero");

  const updated = await User.findByIdAndUpdate(
    userId,
    { $set: { walletBalance: newBalance } },
    { returnDocument: "after" }
  );

  const txn = await WalletTransaction.create({
    user: userId,
    amount: amt,
    type: "admin_adjustment",
    description: description || `Adjusted by admin ${adminId}`,
    balanceAfter: newBalance,
  });

  return { user: updated, transaction: txn };
};

const TEAM_MAX_DEPTH = MAX_COMMISSION_HOPS;
const TEAM_BATCH_LIMIT = 200;

const levelMeta = (childOrgLevel, depthFromViewer) => {
  const hopSlot = slotForHop(depthFromViewer);
  const pct = hopSlot ? Math.round(hopSlot.rate * 100) : null;
  const direct = depthFromViewer === 1;

  return {
    level: childOrgLevel,
    type: direct ? "direct" : "indirect",
    label: direct
      ? `Level ${childOrgLevel} — Direct referral`
      : `Level ${childOrgLevel} — Downline`,
    shortLabel: direct ? `L${childOrgLevel} direct` : `L${childOrgLevel}`,
    commissionNote: pct
      ? `You earn ${pct}% of the MLM pool on their delivered orders (hop ${depthFromViewer}).`
      : "Member in your team tree.",
  };
};

const toMember = (doc, childOrgLevel, depthFromViewer) => {
  const sponsorDoc =
    doc.sponsor && typeof doc.sponsor === "object" && doc.sponsor.name
      ? doc.sponsor
      : null;
  return {
    _id: doc._id,
    name: doc.name,
    email: doc.email,
    referralCode: doc.referralCode,
    walletBalance: doc.walletBalance,
    createdAt: doc.createdAt,
    sponsorId: sponsorDoc?._id || doc.sponsor || null,
    referredBy: sponsorDoc
      ? {
          _id: sponsorDoc._id,
          name: sponsorDoc.name,
          referralCode: sponsorDoc.referralCode,
        }
      : null,
    orgLevel: doc.orgLevel ?? childOrgLevel,
    ...levelMeta(childOrgLevel, depthFromViewer),
  };
};

const childOrgLevelFor = (viewerOrgLevel, depth) =>
  Math.min((viewerOrgLevel ?? 0) + depth, ORG_MAX_LEVEL);

const fetchDownlineByDepth = async (rootId, maxDepth = TEAM_MAX_DEPTH) => {
  const flat = [];
  let parentIds = [rootId];

  for (let depth = 1; depth <= maxDepth && parentIds.length; depth += 1) {
    const batch = await User.find({
      sponsor: { $in: parentIds },
      role: "user",
      blocked: { $ne: true },
      isActive: { $ne: false },
    })
      .select("name email referralCode walletBalance createdAt sponsor orgLevel")
      .populate("sponsor", "name email referralCode")
      .sort({ createdAt: 1 })
      .limit(TEAM_BATCH_LIMIT);

    if (!batch.length) break;

    for (const doc of batch) {
      flat.push({ doc, depth });
    }
    parentIds = batch.map((u) => u._id);
  }

  return flat;
};

const sponsorIdOf = (doc) => {
  const s = doc.sponsor;
  if (!s) return null;
  if (typeof s === "object" && s._id) return String(s._id);
  return String(s);
};

const buildDownlineTree = (rootId, flat, viewerOrgLevel) => {
  const bySponsor = new Map();
  for (const { doc, depth } of flat) {
    const key = sponsorIdOf(doc);
    if (!key) continue;
    if (!bySponsor.has(key)) bySponsor.set(key, []);
    bySponsor.get(key).push({ doc, depth });
  }

  const attach = (parentId, parentDepth) => {
    const kids = bySponsor.get(String(parentId)) || [];
    return kids.map(({ doc, depth }) => {
      const childLevel = doc.orgLevel ?? childOrgLevelFor(viewerOrgLevel, depth);
      const meta = levelMeta(childLevel, depth);
      return {
        ...meta,
        member: toMember(doc, childLevel, depth),
        children: attach(doc._id, depth),
      };
    });
  };

  return attach(rootId, 0);
};

const getMlmTeam = async (userId) => {
  const user = await User.findById(userId)
    .select("referralCode sponsor walletBalance name email orgLevel")
    .populate("sponsor", "name email referralCode");

  const viewerOrgLevel =
    user.orgLevel !== null && user.orgLevel !== undefined
      ? user.orgLevel
      : await getOrgLevel(userId);

  const flat = await fetchDownlineByDepth(userId);
  const direct = flat
    .filter((x) => x.depth === 1)
    .map((x) =>
      toMember(
        x.doc,
        x.doc.orgLevel ?? childOrgLevelFor(viewerOrgLevel, 1),
        1
      )
    );
  const indirect = flat
    .filter((x) => x.depth > 1)
    .map((x) =>
      toMember(
        x.doc,
        x.doc.orgLevel ?? childOrgLevelFor(viewerOrgLevel, x.depth),
        x.depth
      )
    );

  const membersByLevel = [];
  for (let d = 1; d <= TEAM_MAX_DEPTH; d += 1) {
    const childLevel = childOrgLevelFor(viewerOrgLevel, d);
    const members = flat
      .filter((x) => x.depth === d)
      .map((x) =>
        toMember(x.doc, x.doc.orgLevel ?? childLevel, d)
      );
    if (!members.length) continue;
    const meta = levelMeta(childLevel, d);
    membersByLevel.push({
      level: childLevel,
      type: meta.type,
      label: meta.label,
      shortLabel: meta.shortLabel,
      commissionNote: meta.commissionNote,
      count: members.length,
      members,
    });
  }

  const tree = {
    level: viewerOrgLevel ?? 0,
    type: viewerOrgLevel === 0 ? "head" : "you",
    label:
      viewerOrgLevel === 0
        ? "You (org head)"
        : `You (${orgLevelLabel(viewerOrgLevel)})`,
    shortLabel: viewerOrgLevel === 0 ? "Head" : `L${viewerOrgLevel}`,
    commissionNote: canRefer(viewerOrgLevel)
      ? `Direct referral = hop 1 (30%). Indirect hops 2–6 = 20/20/10/10/10. Beyond 6 hops below you, that branch exits your commission window. Depth 7+ from head counts as level 6. Not on your own orders.`
      : "Cannot refer.",
    member: {
      _id: user._id,
      name: user.name,
      email: user.email,
      referralCode: canRefer(viewerOrgLevel) ? user.referralCode : null,
      walletBalance: user.walletBalance,
      orgLevel: viewerOrgLevel,
      canRefer: canRefer(viewerOrgLevel),
    },
    children: buildDownlineTree(userId, flat, viewerOrgLevel),
  };

  return {
    user,
    orgLevel: viewerOrgLevel,
    canRefer: canRefer(viewerOrgLevel),
    sponsor: user?.sponsor || null,
    directReferrals: direct,
    indirectReferrals: indirect,
    count: direct.length,
    directCount: direct.length,
    indirectCount: indirect.length,
    totalTeamCount: flat.length,
    membersByLevel,
    tree,
    maxDepth: TEAM_MAX_DEPTH,
  };
};

const getCompanyWallet = async ({ page = 1, limit = 30 } = {}) => {
  const admin = await findDefaultAdminRecipient();
  if (!admin) throw new Error("No company wallet account configured");

  const account = await User.findById(admin._id).select(
    "name email walletBalance referralCode role createdAt"
  );

  const [byType, unallocatedLevels, allUsersBalance] = await Promise.all([
    WalletTransaction.aggregate([
      { $match: { user: account._id } },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
    WalletTransaction.aggregate([
      { $match: { user: account._id, type: "unallocated" } },
      {
        $group: {
          _id: "$mlmLevel",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
    User.aggregate([
      { $match: { role: "user" } },
      { $group: { _id: null, total: { $sum: "$walletBalance" } } },
    ]),
  ]);

  const breakdownByType = {};
  let totalIn = 0;
  let totalOut = 0;

  for (const row of byType) {
    const total = roundMoney(row.total);
    breakdownByType[row._id] = { total, count: row.count };
    if (total > 0) totalIn += total;
    if (total < 0) totalOut += total;
  }

  const txData = await getTransactions(account._id, { page, limit });

  return {
    account: {
      _id: account._id,
      name: account.name,
      email: account.email,
      walletBalance: roundMoney(account.walletBalance || 0),
      referralCode: account.referralCode,
      role: account.role,
      createdAt: account.createdAt,
    },
    summary: {
      balance: roundMoney(account.walletBalance || 0),
      catalogProfitShare: breakdownByType.admin_share?.total || 0,
      unallocatedMlm: breakdownByType.unallocated?.total || 0,
      manualAdjustments: breakdownByType.admin_adjustment?.total || 0,
      mlmCommissions: breakdownByType.mlm_commission?.total || 0,
      totalUserWallets: roundMoney(allUsersBalance[0]?.total || 0),
      lifetimeCredits: roundMoney(totalIn),
      lifetimeDebits: roundMoney(totalOut),
    },
    breakdownByType,
    unallocatedByLevel: unallocatedLevels
      .filter((row) => row._id)
      .map((row) => ({
        level: row._id,
        total: roundMoney(row.total),
        count: row.count,
      }))
      .sort((a, b) => {
        const order = [
          "upline1",
          "upline2",
          "upline3",
          "upline4",
          "upline5",
          "upline6",
          "head",
          "level1",
          "level2",
          "level3",
          "level4",
          "level5",
          "level6",
        ];
        return order.indexOf(a.level) - order.indexOf(b.level);
      }),
    transactions: txData.transactions,
    pagination: txData.pagination,
  };
};

module.exports = {
  getWalletSummary,
  getTransactions,
  getDeliveryWalletSummary,
  getDeliveryTransactions,
  adminListWallets,
  adminAdjustWallet,
  getMlmTeam,
  getCompanyWallet,
  creditWallet,
};
