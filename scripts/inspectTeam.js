require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../api/user/model/model");
const { getMlmTeam } = require("../api/wallet/services");

const run = async () => {
  await connectDB();

  const users = await User.find({ role: "user" })
    .select("name email referralCode sponsor blocked isActive createdAt")
    .populate("sponsor", "name email referralCode")
    .sort({ createdAt: 1 })
    .lean();

  console.log("=== USERS (sponsor chain) ===\n");
  for (const u of users) {
    console.log({
      name: u.name,
      email: u.email,
      code: u.referralCode,
      sponsor: u.sponsor
        ? `${u.sponsor.name} (${u.sponsor.referralCode})`
        : "NONE",
      sponsorId: u.sponsor?._id?.toString() || null,
      blocked: u.blocked,
      isActive: u.isActive,
    });
  }

  const rahul =
    (await User.findOne({ referralCode: "RAHUL01" })) ||
    (await User.findOne({ email: "rahul@shop.com" }));

  if (!rahul) {
    console.log("\nRahul not found in DB");
    process.exit(0);
  }

  const rid = rahul._id.toString();
  const all = await User.find({ role: "user" })
    .select("name sponsor blocked isActive")
    .lean();

  const bySponsor = {};
  for (const u of all) {
    const k = u.sponsor ? String(u.sponsor) : "none";
    if (!bySponsor[k]) bySponsor[k] = [];
    bySponsor[k].push({
      name: u.name,
      blocked: u.blocked,
      isActive: u.isActive,
    });
  }

  console.log("\n=== CHILDREN BY SPONSOR ID ===");
  console.log("Under Rahul:", bySponsor[rid] || []);
  const priya = await User.findOne({ referralCode: "PRIYA01" });
  if (priya) {
    console.log("Under Priya:", bySponsor[String(priya._id)] || []);
  }

  const team = await getMlmTeam(rahul._id);
  console.log("\n=== getMlmTeam(Rahul) ===");
  console.log({
    directCount: team.directCount,
    indirectCount: team.indirectCount,
    totalTeamCount: team.totalTeamCount,
    levels: team.membersByLevel?.map((l) => ({
      level: l.level,
      type: l.type,
      names: l.members.map((m) => m.name),
    })),
    treeChildren: team.tree?.children?.map((c) => ({
      name: c.member.name,
      level: c.level,
      nested: c.children?.map((n) => n.member.name),
    })),
  });

  await mongoose.disconnect();
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
