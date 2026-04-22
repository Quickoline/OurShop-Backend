const express = require("express");
const {
     createUser,
    getAllUsers,
    getUserById,
    getUserByEmail,
    updateUser,
    deleteUser,
    updateUserPassword,
    toggleUserBlocked,
    addAddress,
    updateAddress,
    deleteAddress,
    addToWishlist,
    removeFromWishlist,
    getWishlist,
    toggleNewsletter,
} = require("../controller/controller");
const {
    authenticate,
    authorizeRoles,
    allowSelfOrAdmin,
} = require("../../../auth/auth");

const router = express.Router();

router.get("/email/:email", authenticate, authorizeRoles("admin"), getUserByEmail);

router.get("/:id/wishlist", authenticate, allowSelfOrAdmin("id"), getWishlist);
router.post("/:id/wishlist", authenticate, allowSelfOrAdmin("id"), addToWishlist);
router.delete("/:id/wishlist/:productId", authenticate, allowSelfOrAdmin("id"), removeFromWishlist);


router.post("/:id/addressess", authenticate, allowSelfOrAdmin("id"), addAddress);
router.put("/:id/addressess/:addressId", authenticate, allowSelfOrAdmin("id"), updateAddress);
router.delete("/:id/addressess/:addressId", authenticate, allowSelfOrAdmin("id"), deleteAddress);

router.patch("/:id/block", authenticate, authorizeRoles("admin"), toggleUserBlocked);
router.patch("/:id/newsletter", authenticate, allowSelfOrAdmin("id"), toggleNewsletter);

router.post("/", createUser);
router.get("/", authenticate, authorizeRoles("admin"), getAllUsers);
router.get("/:id", authenticate, allowSelfOrAdmin("id"), getUserById);
router.put("/:id", authenticate, allowSelfOrAdmin("id"), updateUser);
router.delete("/:id", authenticate, authorizeRoles("admin"), deleteUser);
router.patch("/:id/password", authenticate, allowSelfOrAdmin("id"), updateUserPassword);


module.exports = router;
