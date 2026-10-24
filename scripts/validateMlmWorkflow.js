/**
 * Validate MLM sliding-window workflow (a→b→…→g→h→i example).
 * Usage: node scripts/validateMlmWorkflow.js
 */
const { planPayoutsFromUpline } = require("../api/mlm/payoutPlan");
const { MAX_COMMISSION_HOPS } = require("../api/mlm/constants");

const printPlan = (title, buyer, chainFromHead) => {
  const idx = chainFromHead.indexOf(buyer);
  const uplinesAboveBuyer = chainFromHead.slice(0, idx).reverse();
  const plan = planPayoutsFromUpline(uplinesAboveBuyer.map((name) => ({ name })));

  console.log(`\n=== ${title} ===`);
  console.log(`Buyer: ${buyer}`);
  console.log(`Org chain (head→buyer): ${chainFromHead.join(" → ")}`);
  console.log(`Effective head for this order (hop ${MAX_COMMISSION_HOPS}): ${plan.effectiveHead?.name || "—"}`);
  if (plan.exitedAbove.length) {
    console.log(`Exited (no payout): ${plan.exitedAbove.map((u) => u.name).join(", ")}`);
  }
  console.log("Payouts:");
  for (const p of plan.payouts) {
    console.log(`  hop ${p.hop} (${Math.round(p.rate * 100)}%) → ${p.recipient.name}`);
  }
  if (plan.unallocated.length) {
    console.log("Unallocated → company wallet:");
    for (const u of plan.unallocated) {
      console.log(`  hop ${u.hop} (${Math.round(u.rate * 100)}%)`);
    }
  }
  return plan;
};

const chain = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];

printPlan("Order by G (depth 6 from head A)", "g", chain.slice(0, 7));
printPlan("Order by H (depth 7 — A exits, B = effective head)", "h", chain.slice(0, 8));
printPlan("Order by I (depth 8 — A,B exit, C = effective head)", "i", chain);

const hPlan = planPayoutsFromUpline(["g", "f", "e", "d", "c", "b"].map((n) => ({ name: n })));
const aGetsOnH = hPlan.payouts.some((p) => p.recipient.name === "a");
const bIsHead = hPlan.effectiveHead?.name === "b";

console.log("\n=== ASSERTIONS ===");
console.log(`H order: A receives nothing? ${!aGetsOnH ? "PASS" : "FAIL"}`);
console.log(`H order: B is effective head (hop 6)? ${bIsHead ? "PASS" : "FAIL"}`);

const iPlan = planPayoutsFromUpline(["h", "g", "f", "e", "d", "c"].map((n) => ({ name: n })));
console.log(`I order: C is effective head? ${iPlan.effectiveHead?.name === "c" ? "PASS" : "FAIL"}`);
console.log(`I order: B exited? ${!iPlan.payouts.some((p) => p.recipient.name === "b") ? "PASS" : "FAIL"}`);

process.exit(aGetsOnH || !bIsHead ? 1 : 0);
