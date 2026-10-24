const express = require("express");
const {
       createProduct,
    getAllProducts,
    getProductById,
    getProductBySlug,
    updateProduct,
    deleteProduct,
    getBestSellerProducts,
    getNewlyLaunchedProducts,
    getMegaOfferProducts,
    getProductsByCategory,
    getRelatedProducts,
    searchProducts,
} = require("../controller/controller");
const { uploadProductMedia } = require("../middleware/uploadMedia");
const { authenticate, authorizeRoles } = require("../../../auth/auth");

const router = express.Router();

router.get("/bestsellers", getBestSellerProducts);
router.get("/newlylaunched", getNewlyLaunchedProducts);
router.get("/megaoffers", getMegaOfferProducts);
router.get("/search", searchProducts);
router.get("/category/:categoryId", getProductsByCategory);
router.get("/slug/:slug", getProductBySlug);
router.get("/:id/related", getRelatedProducts);


router.post("/", authenticate, authorizeRoles("admin", "vendor"), uploadProductMedia, createProduct);
router.get("/", getAllProducts);
router.get("/:id", getProductById);
router.put("/:id", authenticate, authorizeRoles("admin", "vendor"), uploadProductMedia, updateProduct);
router.delete("/:id", authenticate, authorizeRoles("admin", "vendor"), deleteProduct);

module.exports = router;