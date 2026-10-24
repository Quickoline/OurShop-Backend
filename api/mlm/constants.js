/** 50% of catalog profit (product/service) goes to admin pool, 50% to MLM pool */
const ADMIN_SHARE_OF_PROFIT = 0.5;
const MLM_SHARE_OF_PROFIT = 0.5;

/**
 * One head + up to 6 depth levels. On any order, the buyer is the bottom of their sponsor chain.
 * MLM pool (50% of line profit) flows up to 6 hops: 30%, 20%, 20%, 10%, 10%, 10%.
 * Missing hops → company wallet. Buyer never earns on own order.
 */
const MLM_UPLINE_SLOTS = [
  { slot: "upline1", rate: 0.3, hop: 1, label: "Direct sponsor (30%)" },
  { slot: "upline2", rate: 0.2, hop: 2, label: "2nd upline (20%)" },
  { slot: "upline3", rate: 0.2, hop: 3, label: "3rd upline (20%)" },
  { slot: "upline4", rate: 0.1, hop: 4, label: "4th upline (10%)" },
  { slot: "upline5", rate: 0.1, hop: 5, label: "5th upline (10%)" },
  { slot: "upline6", rate: 0.1, hop: 6, label: "6th upline / head (10%)" },
];

const MLM_LEVEL_RATES = Object.fromEntries(
  MLM_UPLINE_SLOTS.map(({ slot, rate }) => [slot, rate])
);

const MLM_LEVEL_KEYS = MLM_UPLINE_SLOTS.map((s) => s.slot);

/** Max upline/downline commission window (direct = hop 1, indirect hops 2–6). Depth 7+ from head caps at level 6. */
const ORG_MAX_LEVEL = 6;
const ORG_HEAD_LEVEL = 0;
const MAX_COMMISSION_HOPS = 6;

module.exports = {
  ADMIN_SHARE_OF_PROFIT,
  MLM_SHARE_OF_PROFIT,
  MLM_UPLINE_SLOTS,
  MLM_LEVEL_RATES,
  MLM_LEVEL_KEYS,
  ORG_MAX_LEVEL,
  ORG_HEAD_LEVEL,
  MAX_COMMISSION_HOPS,
};
