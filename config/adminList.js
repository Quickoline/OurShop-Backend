/** Admin list endpoints: fetch all rows (no practical cap). */
const ADMIN_LIST_LIMIT = 10000;

const resolveAdminListLimit = (limit) => {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return ADMIN_LIST_LIMIT;
  return Math.min(n, ADMIN_LIST_LIMIT);
};

module.exports = { ADMIN_LIST_LIMIT, resolveAdminListLimit };
