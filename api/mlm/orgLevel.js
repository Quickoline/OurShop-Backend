const User = require("../user/model/model");
const { ORG_MAX_LEVEL, ORG_HEAD_LEVEL, MAX_COMMISSION_HOPS } = require("./constants");

const ORG_LEVEL_LABELS = {
  0: "Head",
  1: "Level 1",
  2: "Level 2",
  3: "Level 3",
  4: "Level 4",
  5: "Level 5",
  6: "Level 6",
};

/** Walk sponsor chain to root. Returns [member, sponsor, …, head]. */
const getOrgChain = async (userId) => {
  const chain = [];
  let current = await User.findById(userId).select("_id sponsor role blocked isActive orgLevel");
  const seen = new Set();

  while (current) {
    const id = String(current._id);
    if (seen.has(id)) break;
    seen.add(id);
    chain.push(current);
    if (!current.sponsor) break;
    current = await User.findById(current.sponsor).select(
      "_id sponsor role blocked isActive orgLevel name email"
    );
  }

  return chain;
};

/** Depth from org head; 7th+ depth from head is capped at level 6. */
const orgLevelFromChain = (chain) => {
  if (!chain.length) return null;
  const self = chain[0];
  if (self.role === "admin") return null;
  return Math.min(chain.length - 1, ORG_MAX_LEVEL);
};

const getOrgLevel = async (userId) => {
  const user = await User.findById(userId).select("orgLevel role");
  if (!user || user.role === "admin") return null;
  if (user.orgLevel !== undefined && user.orgLevel !== null) return user.orgLevel;
  const chain = await getOrgChain(userId);
  return orgLevelFromChain(chain);
};

/** Any active member may refer; tree can grow past depth 6 (new members cap at org level 6). */
const canRefer = (orgLevel) => orgLevel !== null && orgLevel !== undefined;

const canSponsorNewMember = async (sponsorId) => {
  const sponsor = await User.findById(sponsorId).select("role blocked isActive");
  if (!sponsor || sponsor.role !== "user" || sponsor.blocked || !sponsor.isActive) {
    return false;
  }
  const level = await getOrgLevel(sponsorId);
  return canRefer(level);
};

const orgLevelLabel = (orgLevel) => {
  if (orgLevel === null || orgLevel === undefined) return null;
  return ORG_LEVEL_LABELS[orgLevel] || `Level ${orgLevel}`;
};

const validateSponsorForSignup = async (sponsorId) => {
  const sponsor = await User.findById(sponsorId).select(
    "_id role blocked isActive orgLevel sponsor name"
  );
  if (!sponsor || sponsor.role !== "user") {
    throw new Error("Invalid referral code");
  }
  if (sponsor.blocked || !sponsor.isActive) {
    throw new Error("Invalid referral code");
  }

  const sponsorLevel = await getOrgLevel(sponsor._id);
  if (sponsorLevel === null) {
    throw new Error("Invalid referral code");
  }
  if (!canRefer(sponsorLevel)) {
    throw new Error("Invalid referral code");
  }

  // Depth 7+ from head is stored as level 6 (sliding window — upline beyond 6 hops exits).
  const orgLevel = Math.min(sponsorLevel + 1, ORG_MAX_LEVEL);

  return { sponsor, orgLevel };
};

const backfillOrgLevel = async (userId) => {
  const chain = await getOrgChain(userId);
  const level = orgLevelFromChain(chain);
  if (level === null) return null;
  await User.findByIdAndUpdate(userId, { $set: { orgLevel: level } });
  return level;
};

module.exports = {
  ORG_LEVEL_LABELS,
  ORG_HEAD_LEVEL,
  MAX_COMMISSION_HOPS,
  getOrgChain,
  getOrgLevel,
  orgLevelFromChain,
  canRefer,
  canSponsorNewMember,
  orgLevelLabel,
  validateSponsorForSignup,
  backfillOrgLevel,
};
