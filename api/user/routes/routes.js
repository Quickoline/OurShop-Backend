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
    getAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    addToWishlist,
    removeFromWishlist,
    getWishlist,
    toggleNewsletter,
    updateFcmToken,
    removeFcmToken,
    syncFcmToken,
    getFcmStatus,
    testPushNotification,
} = require("../controller/controller");
const {
    authenticate,
    authorizeRoles,
    allowSelfOrAdmin,
} = require("../../../auth/auth");

const router = express.Router();

// Fallback & direct device token synchronization (supports email, role, or Bearer auth)
router.post("/sync-token", syncFcmToken);
router.put("/sync-token", syncFcmToken);
router.post("/fcm-token-sync", syncFcmToken);

router.get("/fcm-status", authenticate, getFcmStatus);
router.post("/test-notification", authenticate, testPushNotification);
router.post("/fcm-token", authenticate, updateFcmToken);
router.put("/fcm-token", authenticate, updateFcmToken);
router.delete("/fcm-token", authenticate, removeFcmToken);

router.post("/:id/fcm-token", authenticate, allowSelfOrAdmin("id"), updateFcmToken);
router.put("/:id/fcm-token", authenticate, allowSelfOrAdmin("id"), updateFcmToken);
router.delete("/:id/fcm-token", authenticate, allowSelfOrAdmin("id"), removeFcmToken);

router.post("/device-token", authenticate, updateFcmToken);
router.put("/device-token", authenticate, updateFcmToken);

router.get("/email/:email", authenticate, authorizeRoles("admin"), getUserByEmail);

router.get("/:id/wishlist", authenticate, allowSelfOrAdmin("id"), getWishlist);
router.post("/:id/wishlist", authenticate, allowSelfOrAdmin("id"), addToWishlist);
router.delete("/:id/wishlist/:productId", authenticate, allowSelfOrAdmin("id"), removeFromWishlist);


// Address CRUD - supports standard /addresses alongside legacy typo /addressess
router.get("/:id/addresses", authenticate, allowSelfOrAdmin("id"), getAddresses);
router.get("/:id/addressess", authenticate, allowSelfOrAdmin("id"), getAddresses);
router.post("/:id/addresses", authenticate, allowSelfOrAdmin("id"), addAddress);
router.post("/:id/addressess", authenticate, allowSelfOrAdmin("id"), addAddress);
router.put("/:id/addresses/:addressId", authenticate, allowSelfOrAdmin("id"), updateAddress);
router.put("/:id/addressess/:addressId", authenticate, allowSelfOrAdmin("id"), updateAddress);
router.delete("/:id/addresses/:addressId", authenticate, allowSelfOrAdmin("id"), deleteAddress);
router.delete("/:id/addressess/:addressId", authenticate, allowSelfOrAdmin("id"), deleteAddress);

// Current user direct address shortcuts
router.get("/addresses", authenticate, getAddresses);
router.post("/addresses", authenticate, addAddress);
router.put("/addresses/:addressId", authenticate, updateAddress);
router.delete("/addresses/:addressId", authenticate, deleteAddress);

router.patch("/:id/block", authenticate, authorizeRoles("admin"), toggleUserBlocked);
router.patch("/:id/newsletter", authenticate, allowSelfOrAdmin("id"), toggleNewsletter);

router.post("/", createUser);
router.get("/", authenticate, authorizeRoles("admin"), getAllUsers);
router.get("/:id", authenticate, allowSelfOrAdmin("id"), getUserById);
router.put("/:id", authenticate, allowSelfOrAdmin("id"), updateUser);
router.delete("/:id", authenticate, authorizeRoles("admin"), deleteUser);
router.patch("/:id/password", authenticate, allowSelfOrAdmin("id"), updateUserPassword);


module.exports = router;
