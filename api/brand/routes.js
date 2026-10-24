const express = require("express");
const {
    createBrand,
    getAllBrands,
    getActiveBrands,
    getFeaturedBrands,
    getBrandById,
    getBrandBySlug,
    updateBrand,
    deleteBrand,
} = require("../brand/controller");
const { authenticate, authorizeRoles } = require("../../auth/auth");

const router = express.Router();

router.post("/", authenticate, authorizeRoles("admin"), createBrand);
router.get("/", getAllBrands);
router.get("/active", getActiveBrands);
router.get("/featured", getFeaturedBrands);
router.get("/:id", getBrandById);
router.get("/slug/:slug", getBrandBySlug);
router.put("/:id", authenticate, authorizeRoles("admin"), updateBrand);
router.delete("/:id", authenticate, authorizeRoles("admin"), deleteBrand);

module.exports = router;