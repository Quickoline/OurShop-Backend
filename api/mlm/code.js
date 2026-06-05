const crypto = require("crypto");

const generateReferralCode = (name = "user") => {
  const base = String(name)
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase() || "USR";
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${base}${suffix}`;
};

module.exports = { generateReferralCode };
