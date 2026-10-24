const { MLM_UPLINE_SLOTS, MAX_COMMISSION_HOPS } = require("./constants");

/**
 * Pure payout plan from an ordered upline list (index 0 = direct sponsor of buyer).
 * Matches distribute.js: hop 1..6 get 30/20/20/10/10/10; hop 7+ excluded (exit).
 */
const planPayoutsFromUpline = (uplineMembers, mlmPool = 100) => {
  const payouts = [];
  const unallocated = [];

  for (const { slot, rate, hop, label } of MLM_UPLINE_SLOTS) {
    const recipient = uplineMembers[hop - 1] || null;
    const share = Math.round(mlmPool * rate * 100) / 100;
    if (recipient) {
      payouts.push({ hop, slot, rate, share, recipient, label });
    } else {
      unallocated.push({ hop, slot, rate, share, label });
    }
  }

  const effectiveHead = uplineMembers[MAX_COMMISSION_HOPS - 1] || null;
  const exitedAbove = uplineMembers.slice(MAX_COMMISSION_HOPS);

  return { payouts, unallocated, effectiveHead, exitedAbove };
};

/** Build upline name chain from buyer upward for simulation. */
const uplineNamesFromChain = (chainBottomToTop) => {
  const buyer = chainBottomToTop[0];
  const uplines = [];
  for (let i = 1; i < chainBottomToTop.length; i += 1) {
    uplines.push({ name: chainBottomToTop[i], hop: i });
  }
  return { buyer, uplines };
};

module.exports = {
  planPayoutsFromUpline,
  uplineNamesFromChain,
};
