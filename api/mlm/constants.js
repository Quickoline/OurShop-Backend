/** 50% of catalog profit (product/service) goes to admin pool, 50% to MLM pool */
const ADMIN_SHARE_OF_PROFIT = 0.5;
const MLM_SHARE_OF_PROFIT = 0.5;

/** Percentages of the MLM pool (must sum to 1) */
const MLM_LEVEL_RATES = {
  head: 0.1,
  level1: 0.1,
  level2: 0.1,
  level3: 0.1,
  level4: 0.1,
  level5: 0.2,
  level6: 0.3,
};

const MLM_LEVEL_KEYS = ["head", "level1", "level2", "level3", "level4", "level5", "level6"];

module.exports = {
  ADMIN_SHARE_OF_PROFIT,
  MLM_SHARE_OF_PROFIT,
  MLM_LEVEL_RATES,
  MLM_LEVEL_KEYS,
};
