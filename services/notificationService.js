const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

let isFirebaseInitialized = false;

const initFirebase = () => {
  if (isFirebaseInitialized || admin.apps.length > 0) {
    isFirebaseInitialized = true;
    return admin.app();
  }

  try {
    let credential = null;

    // 1. Check environment variable FIREBASE_SERVICE_ACCOUNT (raw JSON, base64, or file path)
    const envServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (envServiceAccount) {
      try {
        if (envServiceAccount.trim().startsWith("{")) {
          credential = admin.credential.cert(JSON.parse(envServiceAccount));
        } else if (fs.existsSync(envServiceAccount)) {
          credential = admin.credential.cert(require(path.resolve(envServiceAccount)));
        } else {
          // Attempt base64 decode
          const decoded = Buffer.from(envServiceAccount, "base64").toString("utf8");
          credential = admin.credential.cert(JSON.parse(decoded));
        }
      } catch (e) {
        console.warn("[FCM] Failed parsing FIREBASE_SERVICE_ACCOUNT env var:", e.message);
      }
    }

    // 2. Check local config/serviceAccountKey.json
    if (!credential) {
      const localKeyPath = path.join(__dirname, "../config/serviceAccountKey.json");
      if (fs.existsSync(localKeyPath)) {
        try {
          credential = admin.credential.cert(require(localKeyPath));
        } catch (e) {
          console.warn("[FCM] Error loading config/serviceAccountKey.json:", e.message);
        }
      }
    }

    if (credential) {
      admin.initializeApp({ credential });
      isFirebaseInitialized = true;
      console.log("[FCM] Firebase Admin SDK successfully initialized.");
      return admin.app();
    } else {
      console.warn(
        "[FCM] Firebase Service Account key not found. Place serviceAccountKey.json in config/ or set FIREBASE_SERVICE_ACCOUNT env var. Notifications will be queued/logged."
      );
    }
  } catch (err) {
    console.error("[FCM] Firebase initialization error:", err.message);
  }
  return null;
};

// Initialize on module load
initFirebase();

/**
 * Register or update an FCM device token for a user
 */
const registerFcmToken = async (userId, token) => {
  if (!userId || !token) return false;
  try {
    const User = mongoose.model("User");
    await User.findByIdAndUpdate(userId, {
      $addToSet: { fcmTokens: token.trim() },
    });
    return true;
  } catch (err) {
    console.error("[FCM] Error saving token:", err.message);
    return false;
  }
};

/**
 * Remove an FCM device token on logout
 */
const unregisterFcmToken = async (userId, token) => {
  if (!userId || !token) return false;
  try {
    const User = mongoose.model("User");
    await User.findByIdAndUpdate(userId, {
      $pull: { fcmTokens: token.trim() },
    });
    return true;
  } catch (err) {
    console.error("[FCM] Error removing token:", err.message);
    return false;
  }
};

/**
 * Send push notification to all admins (and order vendors) when an order is placed
 */
const sendNewOrderNotification = async (order) => {
  if (!order) return;

  try {
    const User = mongoose.model("User");

    // Collect all admin and order-admin users who have registered FCM tokens
    const admins = await User.find({
      $or: [{ role: "admin" }, { isOrderAdmin: true }],
      "fcmTokens.0": { $exists: true },
    }).select("fcmTokens name email");

    let allTokens = [];
    admins.forEach((adminUser) => {
      if (Array.isArray(adminUser.fcmTokens)) {
        allTokens.push(...adminUser.fcmTokens);
      }
    });

    // Remove duplicates and empty tokens
    allTokens = Array.from(new Set(allTokens.filter((t) => typeof t === "string" && t.trim().length > 10)));

    if (!allTokens.length) {
      console.log(`[FCM] No admin devices registered to receive order notification for Order #${order.invoiceNumber || order._id}`);
      return;
    }

    const app = initFirebase();
    if (!app) {
      console.log(`[FCM Sim] New Order #${order.invoiceNumber || order._id} for ₹${order.totalPrice || 0}. (Pending serviceAccountKey.json to deliver to ${allTokens.length} device tokens)`);
      return;
    }

    const invoice = order.invoiceNumber || `INV-${order._id.toString().slice(-6).toUpperCase()}`;
    const amount = Number(order.totalPrice || 0).toLocaleString("en-IN");
    const customerName = order.shippingAddress?.fullName || "A Customer";

    const title = "New Order Placed! 🛒";
    const body = `Order #${invoice} for ₹${amount} received from ${customerName}. Tap to manage.`;

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        type: "NEW_ORDER",
        orderId: String(order._id),
        invoiceNumber: String(invoice),
        totalPrice: String(order.totalPrice || ""),
        customerName: String(customerName),
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
      android: {
        priority: "high",
        notification: {
          channelId: "admin_orders_channel",
          sound: "default",
          priority: "high",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
      tokens: allTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[FCM] Order #${invoice} notification sent: ${response.successCount} succeeded, ${response.failureCount} failed.`);

    // Automatically purge invalid/expired tokens
    if (response.failureCount > 0) {
      const tokensToRemove = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === "messaging/registration-token-not-registered" ||
            errorCode === "messaging/invalid-registration-token"
          ) {
            tokensToRemove.push(allTokens[idx]);
          }
        }
      });

      if (tokensToRemove.length > 0) {
        await User.updateMany(
          { fcmTokens: { $in: tokensToRemove } },
          { $pull: { fcmTokens: { $in: tokensToRemove } } }
        );
        console.log(`[FCM] Cleaned up ${tokensToRemove.length} expired FCM token(s).`);
      }
    }
  } catch (err) {
    console.error("[FCM] Error sending new order notification:", err.message);
  }
};

module.exports = {
  initFirebase,
  registerFcmToken,
  unregisterFcmToken,
  sendNewOrderNotification,
};

