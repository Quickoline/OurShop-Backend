const User = require("../user/model/model");
const { generateReferralCode } = require("./code");

const ensureReferralCode = async (user) => {
  if (user.referralCode) return user.referralCode;
  let code;
  let exists = true;
  while (exists) {
    code = generateReferralCode(user.name);
    exists = await User.exists({ referralCode: code });
  }
  user.referralCode = code;
  await user.save();
  return code;
};

const resolveSponsorByCode = async (referralCode) => {
  if (!referralCode || typeof referralCode !== "string") return null;
  const normalized = referralCode.trim().toUpperCase();
  if (!normalized) return null;
  const sponsor = await User.findOne({
    referralCode: normalized,
    role: "user",
    blocked: false,
    isActive: true,
  }).select("_id referralCode name");
  return sponsor;
};

/** Walk sponsor chain upward (who referred the buyer). */
const getAncestorChain = async (buyerId, maxDepth = 20) => {
  const chain = [];
  let current = await User.findById(buyerId).select("sponsor");
  let depth = 0;

  while (current?.sponsor && depth < maxDepth) {
    const sponsor = await User.findById(current.sponsor).select(
      "_id name email sponsor role blocked isActive"
    );
    if (!sponsor || sponsor.blocked || !sponsor.isActive) break;
    chain.push(sponsor);
    current = sponsor;
    depth += 1;
  }

  return chain;
};

/**
 * Downline leg from buyer: level1 = earliest direct referral,
 * level2 = that member's direct referral, etc.
 */
/** Everyone who joined with the buyer's referral code (team Level 1 under buyer). */
const getDirectReferrals = async (buyerId) => {
  return User.find({
    sponsor: buyerId,
    role: "user",
    blocked: { $ne: true },
    isActive: { $ne: false },
  })
    .select("_id name email referralCode")
    .sort({ createdAt: 1 });
};

const getDownlineLegChain = async (buyerId, maxDepth = 6) => {
  const chain = [];
  let parentId = buyerId;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const child = await User.findOne({
      sponsor: parentId,
      role: "user",
      blocked: false,
      isActive: true,
    })
      .sort({ createdAt: 1 })
      .select("_id name email referralCode sponsor");

    if (!child) break;
    chain.push(child);
    parentId = child._id;
  }

  return chain;
};

const findDefaultAdminRecipient = async () => {
  return User.findOne({ role: "admin", isActive: true })
    .sort({ createdAt: 1 })
    .select("_id name email");
};

module.exports = {
  generateReferralCode,
  ensureReferralCode,
  resolveSponsorByCode,
  getAncestorChain,
  getDirectReferrals,
  getDownlineLegChain,
  findDefaultAdminRecipient,
};
