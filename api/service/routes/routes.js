const express = require("express");
const {
  createService,
  getAllServices,
  getServiceById,
  getServiceBySlug,
  updateService,
  deleteService,
  getFeaturedServices,
  getBestSellerServices,
  getNewlyLaunchedServices,
  getMegaOfferServices,
  getServicesByCategory,
  getRelatedServices,
  searchServices,
} = require("../controller/controller");
const { uploadServiceMedia } = require("../middleware/uploadMedia");
const { authenticate, authorizeRoles } = require("../../../auth/auth");

const router = express.Router();

router.get("/featured", getFeaturedServices);
router.get("/bestsellers", getBestSellerServices);
router.get("/newlylaunched", getNewlyLaunchedServices);
router.get("/megaoffers", getMegaOfferServices);
router.get("/search", searchServices);
router.get("/category/:categoryId", getServicesByCategory);
router.get("/slug/:slug", getServiceBySlug);
router.get("/:id/related", getRelatedServices);

router.post("/", authenticate, authorizeRoles("admin", "vendor"), uploadServiceMedia, createService);
router.get("/", getAllServices);
router.get("/:id", getServiceById);
router.put("/:id", authenticate, authorizeRoles("admin", "vendor"), uploadServiceMedia, updateService);
router.delete("/:id", authenticate, authorizeRoles("admin", "vendor"), deleteService);

module.exports = router;
