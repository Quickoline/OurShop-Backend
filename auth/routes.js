const express = require("express");
const {
  userLogin,
  adminLogin,
  getCurrentUser,
  forgotPassword,
  resetPassword,
} = require("./controller");
const { authenticate, validateResetToken } = require("./auth");
const { updateFcmToken, removeFcmToken } = require("../api/user/controller/controller");

const router = express.Router();

router.post("/login", userLogin);
router.post("/admin/login", adminLogin);
router.post("/forgot-password", forgotPassword);
router.patch("/reset-password/:token", validateResetToken, resetPassword);
router.get("/me", authenticate, getCurrentUser);
router.post("/fcm-token", authenticate, updateFcmToken);
router.put("/fcm-token", authenticate, updateFcmToken);
router.delete("/fcm-token", authenticate, removeFcmToken);

module.exports = router;
