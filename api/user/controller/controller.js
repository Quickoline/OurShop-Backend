const mongoose = require("mongoose");
const {
       createUserService,
    getAllUsersService,
    getUserByIdService,
    getUserByEmailService,
    updateUserService,
    deleteUserService,
    updateUserPasswordService,
    toggleUserBlockedService,
    addAddressService,
    updateAddressService,
    deleteAddressService,
    addToWishlistService,
    removeFromWishlistService,
    getWishlistService,
    toggleNewsletterService,
} = require("../services/services");


const createUser = async (req, res) => {
    try {
        const user = await createUserService(req.body);
        res.status(201).json({
            success: true,
            message: "User created successfully",
            data: user,
        }) ;
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "Email already exists",
            });
        }
        if (
            error.message === "Invalid referral code" ||
            error.message === "Referral code is required" ||
            error.message.includes("cannot refer") ||
            error.message.includes("maximum depth") ||
            error.message.includes("spine member")
        ) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    res.status(500).json({ success: false,
        message: error.message || error.messsage });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const result = await getAllUsersService(req.query);
        res.status(200).json({
            success: true,
            data: result.users,
            pagination: result.pagination,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getUserById = async (req, res) => {
    try {
        const user = await getUserByIdService(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getUserByEmail = async (req, res) => {
    try {
        const user = await getUserByEmailService(req.params.email);
        if(!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message});
    }
};

const updateUser = async (req, res) => {
    try {
        if (req.file) {
            req.body.profileImage = req.file.filename;
        }
        const user = await updateUserService(req.params.id, req.body);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: user,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteUser = async (req, res) => {
    try {
const user = await deleteUserService(req.params.id);
if (!user) {
    return res.status(404).json({
        success: false,
        message: "User not found",
    });
}
res.status(200).json({
    success: true,
    message: "User deleted successfully",
});
} catch (error) {
    res.status(500).json({ success: false, message: error.message });
}
};

const updateUserPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword) {
            return res.status(400).json({
                success: false,
                message: "New password is required",
            });
        }

     const user = await updateUserPasswordService(req.params.id, newPassword);
     if (!user) {
        return res.status(404).json({
            success: false,
            message: "User not found",
        });
     }
     res.status(200).json({
        success: true,
        message: "Password updated successfully",
     });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const toggleUserBlocked = async (req, res) => {
    try {
        const user = await toggleUserBlockedService(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(200).json({
            success: true,
            message: `User ${user.blocked ? "blocked" : "unblocked"} successfully`,
            data: { blocked: user.blocked },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message});
    }
};

const getAddresses = async (req, res) => {
    try {
        const userId = req.params.id || req.user?.id || req.user?._id;
        const user = await getUserByIdService(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(200).json({
            success: true,
            data: user.addresses || [],
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const addAddress = async (req, res) => {
    try{
        const userId = req.params.id || req.user?.id || req.user?._id;
        const user = await addAddressService(userId, req.body);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(201).json({
            success: true,
            message: "Address added successfully",
            data: user.addresses,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateAddress = async (req, res) => {
    try{
        const userId = req.params.id || req.user?.id || req.user?._id;
        const user = await updateAddressService(
            userId,
            req.params.addressId,
            req.body
        );
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User or address not found",
            });
        }
        res.status(200).json({
            success: true,
            message: "Address updated successfully",
            data: user.addresses,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteAddress = async (req, res) => {
    try{
        const userId = req.params.id || req.user?.id || req.user?._id;
        const user = await deleteAddressService(userId, req.params.addressId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(200).json({
            success: true,
            message: "Address deleted successfully",
            data: user.addresses,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const addToWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required",
            });
        }

        const user = await addToWishlistService(req.params.id, productId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(200).json({
            success: true,
            message: "Product added to wishlist",
            data: user.wishlist,
        });
    } catch (error) {
        res.status(500).json({ suucess: false, message: error.message });
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        const user = await removeFromWishlistService(
        req.params.id,
        req.params.productId
        );
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(200).json({
            success: true,
            message: "Product removed from wishlist",
            data: user.wishlist,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getWishlist = async (req, res) => {
    try{
        const wishlist = await getWishlistService(req.params.id);
        if (wishlist === null) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(200).json({
            success: true,
            data: wishlist,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const toggleNewsletter = async (req, res) => {
    try{
        const user = await toggleNewsletterService(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        response.status(200).json({
            success: true,
            message: `Newsletter ${user.subscribedToNewsletter ? "subscribed" : "unsubcribed"} successfully`,
            data: { subscribedToNewsletter: user.subscribedToNewsletter },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateFcmToken = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const body = req.body || {};
        const fcmToken =
            body.fcmToken ||
            body.token ||
            body.fcm_token ||
            body.deviceToken ||
            body.device_token ||
            body.registration_token ||
            req.query.token ||
            req.query.fcmToken;

        if (!fcmToken || typeof fcmToken !== "string" || fcmToken.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: "Valid fcmToken is required (acceptable keys: fcmToken, token, fcm_token, deviceToken)",
            });
        }

        const { registerFcmToken } = require("../../../services/notificationService");
        await registerFcmToken(userId, fcmToken.trim());
        console.log(`[FCM] Token registered for user ${userId} (${req.user?.email || "unknown"}, role: ${req.user?.role}): ${fcmToken.slice(0, 15)}...`);
        res.status(200).json({ success: true, message: "FCM token registered successfully" });
    } catch (error) {
        console.error("[FCM] updateFcmToken error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const removeFcmToken = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const body = req.body || {};
        const fcmToken =
            body.fcmToken ||
            body.token ||
            body.fcm_token ||
            body.deviceToken ||
            body.device_token ||
            body.registration_token ||
            req.query.token ||
            req.query.fcmToken;

        if (!fcmToken || typeof fcmToken !== "string") {
            return res.status(400).json({ success: false, message: "Valid fcmToken is required" });
        }
        const { unregisterFcmToken } = require("../../../services/notificationService");
        await unregisterFcmToken(userId, fcmToken.trim());
        console.log(`[FCM] Token removed for user ${userId} (${req.user?.email || "unknown"})`);
        res.status(200).json({ success: true, message: "FCM token removed successfully" });
    } catch (error) {
        console.error("[FCM] removeFcmToken error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getFcmStatus = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const User = mongoose.model("User");
        const currentUser = await User.findById(userId).select("email role fcmTokens");
        const allUsersWithTokens = await User.find({ "fcmTokens.0": { $exists: true } }).select("email role fcmTokens");
        const { initFirebase } = require("../../../services/notificationService");
        
        res.status(200).json({
            success: true,
            currentUser: {
                id: currentUser?._id,
                email: currentUser?.email,
                role: currentUser?.role,
                tokensCount: currentUser?.fcmTokens?.length || 0,
                tokens: currentUser?.fcmTokens || [],
            },
            totalUsersWithTokens: allUsersWithTokens.length,
            usersSummary: allUsersWithTokens.map((u) => ({
                email: u.email,
                role: u.role,
                tokensCount: u.fcmTokens?.length || 0,
            })),
            firebaseReady: !!initFirebase(),
        });
    } catch (error) {
        console.error("[FCM] getFcmStatus error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const testPushNotification = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const User = mongoose.model("User");
        const user = await User.findById(userId).select("fcmTokens email role");
        if (!user?.fcmTokens?.length) {
            return res.status(400).json({
                success: false,
                message: "No FCM tokens registered for your account. Please enable notifications in app or call POST /api/user/fcm-token.",
            });
        }
        const { initFirebase, sendMulticast } = require("../../../services/notificationService");
        const app = initFirebase();
        if (!app) {
            return res.status(500).json({ success: false, message: "Firebase is not initialized on server." });
        }
        const result = await sendMulticast(
          app,
          user.fcmTokens,
          {
            title: "Test Order Notification 🛒",
            body: `Hello ${user.email}! This is a live top-bar alert test from QuickoShop.`,
          },
          {
            type: "TEST_ORDER",
            orderId: "test-" + Date.now(),
            totalPrice: "999",
            customerName: "QuickoShop Test",
          }
        );
        res.status(200).json({
          success: true,
          message: `Test notification sent to ${user.fcmTokens.length} device(s)`,
          result,
        });
    } catch (error) {
        console.error("[FCM] testPushNotification error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const syncFcmToken = async (req, res) => {
    try {
        const body = req.body || {};
        const fcmToken =
            body.fcmToken ||
            body.token ||
            body.fcm_token ||
            body.deviceToken ||
            body.device_token ||
            body.registration_token ||
            req.query.token ||
            req.query.fcmToken;

        const email = body.email || req.query.email;
        const role = body.role || req.query.role;

        if (!fcmToken || typeof fcmToken !== "string" || fcmToken.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: "Valid fcmToken is required (acceptable keys: fcmToken, token, deviceToken)",
            });
        }

        const User = mongoose.model("User");
        let user = null;

        // 1. Try resolving user from Bearer JWT if present
        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
            try {
                const jwtToken = req.headers.authorization.split(" ")[1];
                const jwt = require("jsonwebtoken");
                const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET || "fallbackSecret");
                if (decoded && (decoded.id || decoded._id)) {
                    user = await User.findById(decoded.id || decoded._id);
                }
            } catch (jwtErr) {
                // Ignore and fall through to email/role fallback
            }
        }

        // 2. Try resolving user by email
        if (!user && email && typeof email === "string" && email.trim().length > 3) {
            user = await User.findOne({ email: email.trim().toLowerCase() });
        }

        // 3. Fallback: if role is admin or delivery, find the active account
        if (!user && (role === "admin" || !email)) {
            user = await User.findOne({ role: "admin", isActive: true });
        } else if (!user && role === "delivery") {
            user = await User.findOne({ role: "delivery", isActive: true });
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "No admin or matching user found to associate this device token with.",
            });
        }

        const { registerFcmToken } = require("../../../services/notificationService");
        await registerFcmToken(user._id, fcmToken.trim());
        console.log(`[FCM] Token synced via /sync-token for user ${user.email} (${user.role}): ${fcmToken.slice(0, 15)}...`);

        res.status(200).json({
            success: true,
            message: "FCM token synced successfully",
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                tokensCount: (user.fcmTokens?.length || 0) + 1,
            },
        });
    } catch (error) {
        console.error("[FCM] syncFcmToken error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
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
};