const express = require("express");
const {
  createCategory,
  getAllCategories,
  getActiveCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
} = require("../category/controller");
const { authenticate, authorizeRoles } = require("../../auth/auth");

const router = express.Router();

router.post("/", authenticate, authorizeRoles("admin"), createCategory);
router.get("/", getAllCategories);
router.get("/active", getActiveCategories);
router.get("/slug/:slug", getCategoryBySlug);
router.get("/:id", getCategoryById);
router.put("/:id", authenticate, authorizeRoles("admin"), updateCategory);
router.delete("/:id", authenticate, authorizeRoles("admin"), deleteCategory);

module.exports = router;
