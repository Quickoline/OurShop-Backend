/**
 * Backfill orgLevel (0=head … 6=leaf buyer) for all users.
 * Usage: node scripts/backfillOrgLevels.js
 */
require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../api/user/model/model");
const { backfillOrgLevel } = require("../api/mlm/orgLevel");

const run = async () => {
  await connectDB();
  const users = await User.find({ role: "user" }).select("_id email orgLevel");
  let updated = 0;

  for (const user of users) {
    const level = await backfillOrgLevel(user._id);
    if (level !== null && level !== user.orgLevel) {
      console.log(`${user.email} → org level ${level}`);
      updated += 1;
    }
  }

  console.log(`Done. Updated ${updated} user(s).`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
