const express = require("express");
const {
  create,
  getone,
  getAll,
  getMyOrders,
  update,
  cancelOrder,
  assignDelivery,
  updateExpectedDeliveryDate,
  deleteone,
  deleteAll,
} = require("./controller");
const { authenticate } = require("../../auth/auth");

const router = express.Router();

router.post("/", authenticate, create);
router.get("/", authenticate, getAll);
router.get("/my-orders", authenticate, getMyOrders);
router.get("/:id", authenticate, getone);
router.put("/:id", authenticate, update);
router.patch("/:id/cancel", authenticate, cancelOrder);
router.patch("/:id/assign-delivery", authenticate, assignDelivery);
router.patch("/:id/expected-delivery", authenticate, updateExpectedDeliveryDate);
router.delete("/:id", authenticate, deleteone);
router.delete("/", authenticate, deleteAll);

module.exports = router;
