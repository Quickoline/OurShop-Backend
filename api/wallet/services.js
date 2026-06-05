const User = require("../user/model/model");
const WalletTransaction = require("./model");
const { creditWallet, roundMoney } = require("../mlm/distribute");
const { findDefaultAdminRecipient } = require("../mlm/referral");

const getWalletSummary = async (userId) => {
  const user = await User.findById(userId).select(
    "walletBalance referralCode sponsor name email"
  );
  if (!user) return null;

  const sponsor = user.sponsor
    ? await User.findById(user.sponsor).select("name email referralCode")
    : null;

  return {
    walletBalance: user.walletBalance || 0,
    referralCode: user.referralCode,
    sponsor,
    name: user.name,
    email: user.email,
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

const adminListWallets = async ({ page = 1, limit = 20, search } = {}) => {
  const filter = { role: "user" };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { referralCode: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [users, total] = await Promise.all([
    User.find(filter)
      .select("name email referralCode walletBalance sponsor blocked isActive createdAt")
      .populate("sponsor", "name email referralCode")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  return {
    users,
    pagination: {
      currentPage: Number(page),
      totalPages: Math.ceil(total / Number(limit)) || 1,
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

const TEAM_MAX_DEPTH = 6;
const TEAM_BATCH_LIMIT = 200;

const levelMeta = (depth) => {
  if (depth === 1) {
    return {
      level: 1,
      type: "direct",
      label: "Level 1 — Direct referral",
      shortLabel: "Direct (L1)",
      commissionNote:
        "You earn Level 1 commission when they place a delivered order.",
    };
  }
  return {
    level: depth,
    type: "indirect",
    label: `Level ${depth} — Indirect referral`,
    shortLabel: `Indirect (L${depth})`,
    commissionNote: `You earn Level ${depth} commission when they place a delivered order.`,
  };
};

const toMember = (doc, depth) => {
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
    ...levelMeta(depth),
  };
};

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
      .select("name email referralCode walletBalance createdAt sponsor")
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

const buildDownlineTree = (rootId, flat) => {
  const bySponsor = new Map();
  for (const { doc, depth } of flat) {
    const key = sponsorIdOf(doc);
    if (!key) continue;
    if (!bySponsor.has(key)) bySponsor.set(key, []);
    bySponsor.get(key).push({ doc, depth });
  }

  const attach = (parentId) => {
    const kids = bySponsor.get(String(parentId)) || [];
    return kids.map(({ doc, depth }) => {
      const meta = levelMeta(depth);
      return {
        ...meta,
        member: toMember(doc, depth),
        children: attach(doc._id),
      };
    });
  };

  return attach(rootId);
};

const getMlmTeam = async (userId) => {
  const user = await User.findById(userId)
    .select("referralCode sponsor walletBalance name email")
    .populate("sponsor", "name email referralCode");

  const flat = await fetchDownlineByDepth(userId);
  const direct = flat.filter((x) => x.depth === 1).map((x) => toMember(x.doc, 1));
  const indirect = flat.filter((x) => x.depth > 1).map((x) => toMember(x.doc, x.depth));

  const membersByLevel = [];
  for (let d = 1; d <= TEAM_MAX_DEPTH; d += 1) {
    const members = flat.filter((x) => x.depth === d).map((x) => toMember(x.doc, d));
    if (!members.length) continue;
    const meta = levelMeta(d);
    membersByLevel.push({
      level: d,
      type: meta.type,
      label: meta.label,
      shortLabel: meta.shortLabel,
      commissionNote: meta.commissionNote,
      count: members.length,
      members,
    });
  }

  const tree = {
    level: 0,
    type: "you",
    label: "You (team head)",
    shortLabel: "You",
    commissionNote: "You earn Head (10%) on your own delivered orders.",
    member: {
      _id: user._id,
      name: user.name,
      email: user.email,
      referralCode: user.referralCode,
      walletBalance: user.walletBalance,
    },
    children: buildDownlineTree(userId, flat),
  };

  return {
    user,
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
        const order = ["head", "level1", "level2", "level3", "level4", "level5", "level6"];
        return order.indexOf(a.level) - order.indexOf(b.level);
      }),
    transactions: txData.transactions,
    pagination: txData.pagination,
  };
};

module.exports = {
  getWalletSummary,
  getTransactions,
  adminListWallets,
  adminAdjustWallet,
  getMlmTeam,
  getCompanyWallet,
  creditWallet,
};
