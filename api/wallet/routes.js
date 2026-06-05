const express = require("express");
const {
  getMyWallet,
  getMyTransactions,
  getMyTeam,
  getMlmConfig,
  adminGetCompanyWallet,
  adminListWallets,
  adminAdjustWallet,
  adminGetUserTransactions,
  distributeOrder,
} = require("./controller");
const { authenticate, authorizeRoles } = require("../../auth/auth");

const router = express.Router();

router.get("/config", getMlmConfig);

router.get("/me", authenticate, getMyWallet);
router.get("/me/transactions", authenticate, getMyTransactions);
router.get("/me/team", authenticate, getMyTeam);

router.get(
  "/admin/company",
  authenticate,
  authorizeRoles("admin"),
  adminGetCompanyWallet
);
router.get("/admin/users", authenticate, authorizeRoles("admin"), adminListWallets);
router.patch(
  "/admin/users/:userId/adjust",
  authenticate,
  authorizeRoles("admin"),
  adminAdjustWallet
);
router.get(
  "/admin/users/:userId/transactions",
  authenticate,
  authorizeRoles("admin"),
  adminGetUserTransactions
);
router.post(
  "/admin/orders/:orderId/distribute",
  authenticate,
  authorizeRoles("admin"),
  distributeOrder
);

module.exports = router;
