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
        "[FCM] Firebase Service Account key not found. Place serviceAccountKey.json in config/ or set FIREBASE_SERVICE_ACCOUNT env var. Notifications will be logged."
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
 * Internal helper to send multicast FCM messages and cleanup invalid tokens
 */
const sendMulticast = async (app, tokens, notification, data) => {
  const cleanTokens = Array.from(
    new Set(tokens.filter((t) => typeof t === "string" && t.trim().length > 10))
  );

  if (!cleanTokens.length) return { successCount: 0, failureCount: 0 };

  const message = {
    notification,
    data: {
      ...data,
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
    tokens: cleanTokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);

    // Automatically purge invalid/expired tokens from DB
    if (response.failureCount > 0) {
      const tokensToRemove = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === "messaging/registration-token-not-registered" ||
            errorCode === "messaging/invalid-registration-token"
          ) {
            tokensToRemove.push(cleanTokens[idx]);
          }
        }
      });

      if (tokensToRemove.length > 0) {
        const User = mongoose.model("User");
        await User.updateMany(
          { fcmTokens: { $in: tokensToRemove } },
          { $pull: { fcmTokens: { $in: tokensToRemove } } }
        );
        console.log(`[FCM] Purged ${tokensToRemove.length} expired token(s).`);
      }
    }

    return response;
  } catch (err) {
    console.error("[FCM] Multicast send error:", err.message);
    return { successCount: 0, failureCount: cleanTokens.length };
  }
};

/**
 * Role-based order notification dispatcher:
 * 1. Superadmin (role: "admin" / isOrderAdmin: true) -> ALL order notifications
 * 2. Delivery Boy (role: "delivery") -> ALL order notifications (new delivery requests)
 * 3. Vendor (role: "vendor") -> ONLY for orders containing their own products
 */
const sendNewOrderNotification = async (order) => {
  if (!order) return;

  try {
    const User = mongoose.model("User");
    const app = initFirebase();

    const invoice = order.invoiceNumber || `INV-${order._id.toString().slice(-6).toUpperCase()}`;
    const totalAmount = Number(order.totalPrice || 0).toLocaleString("en-IN");
    const customerName = order.shippingAddress?.fullName || "A Customer";
    const deliveryCity = order.shippingAddress?.city || "your area";

    // =========================================================================
    // 1. SUPERADMIN NOTIFICATION (ALL Orders)
    // =========================================================================
    const superAdmins = await User.find({
      $or: [{ role: "admin" }, { isOrderAdmin: true }],
      "fcmTokens.0": { $exists: true },
    }).select("fcmTokens");

    const adminTokens = superAdmins.flatMap((u) => u.fcmTokens || []);

    if (adminTokens.length > 0) {
      if (app) {
        await sendMulticast(
          app,
          adminTokens,
          {
            title: "New Order Placed! 🛒",
            body: `Order #${invoice} for ₹${totalAmount} received from ${customerName}. Tap to manage.`,
          },
          {
            type: "NEW_ORDER",
            role: "admin",
            orderId: String(order._id),
            invoiceNumber: String(invoice),
            totalPrice: String(order.totalPrice || ""),
            customerName: String(customerName),
          }
        );
        console.log(`[FCM] Dispatched Superadmin notification for Order #${invoice} to ${adminTokens.length} device(s).`);
      } else {
        console.log(`[FCM Sim] [Superadmin] Order #${invoice} for ₹${totalAmount} from ${customerName}.`);
      }
    }

    // =========================================================================
    // 2. DELIVERY BOY NOTIFICATION (ALL Orders - New delivery available)
    // =========================================================================
    const deliveryBoys = await User.find({
      role: "delivery",
      isActive: true,
      "fcmTokens.0": { $exists: true },
    }).select("fcmTokens");

    const deliveryTokens = deliveryBoys.flatMap((u) => u.fcmTokens || []);

    if (deliveryTokens.length > 0) {
      if (app) {
        await sendMulticast(
          app,
          deliveryTokens,
          {
            title: "New Order Available for Delivery! 🚚",
            body: `Order #${invoice} (₹${totalAmount}) placed for delivery in ${deliveryCity}. Tap to view.`,
          },
          {
            type: "NEW_ORDER",
            role: "delivery",
            orderId: String(order._id),
            invoiceNumber: String(invoice),
            totalPrice: String(order.totalPrice || ""),
            city: String(deliveryCity),
          }
        );
        console.log(`[FCM] Dispatched Delivery Boy notification for Order #${invoice} to ${deliveryTokens.length} device(s).`);
      } else {
        console.log(`[FCM Sim] [Delivery] Order #${invoice} ready for delivery in ${deliveryCity}.`);
      }
    }

    // =========================================================================
    // 3. VENDOR NOTIFICATION (ONLY for vendors whose products are in this order)
    // =========================================================================
    const orderItems = Array.isArray(order.orderItems) ? order.orderItems : [];
    
    // Group items by vendorId
    const vendorItemsMap = new Map();
    orderItems.forEach((item) => {
      const vendorId = item.vendor ? String(item.vendor._id || item.vendor) : null;
      if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
        if (!vendorItemsMap.has(vendorId)) {
          vendorItemsMap.set(vendorId, []);
        }
        vendorItemsMap.get(vendorId).push(item);
      }
    });

    if (vendorItemsMap.size > 0) {
      const vendorIds = Array.from(vendorItemsMap.keys());
      const vendorUsers = await User.find({
        _id: { $in: vendorIds },
        role: "vendor",
        isActive: true,
        "fcmTokens.0": { $exists: true },
      }).select("fcmTokens name");

      for (const vendor of vendorUsers) {
        const vId = String(vendor._id);
        const itemsForVendor = vendorItemsMap.get(vId) || [];
        const vendorTokens = vendor.fcmTokens || [];

        if (!vendorTokens.length || !itemsForVendor.length) continue;

        const vendorItemCount = itemsForVendor.reduce(
          (sum, it) => sum + (Number(it.quantity) || 1),
          0
        );
        const vendorSubtotal = itemsForVendor.reduce(
          (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
          0
        );
        const formattedSubtotal = Number(vendorSubtotal).toLocaleString("en-IN");

        if (app) {
          await sendMulticast(
            app,
            vendorTokens,
            {
              title: "New Order for Your Products! 📦",
              body: `Order #${invoice}: ${vendorItemCount} of your item(s) ordered (₹${formattedSubtotal}). Tap to prepare.`,
            },
            {
              type: "NEW_ORDER",
              role: "vendor",
              orderId: String(order._id),
              invoiceNumber: String(invoice),
              vendorItemsCount: String(vendorItemCount),
              vendorSubtotal: String(vendorSubtotal),
            }
          );
          console.log(`[FCM] Dispatched Vendor (${vendor.name || vId}) notification for Order #${invoice} (${vendorItemCount} item(s)).`);
        } else {
          console.log(`[FCM Sim] [Vendor: ${vendor.name || vId}] Order #${invoice}: ${vendorItemCount} item(s) (₹${formattedSubtotal}).`);
        }
      }
    }
  } catch (err) {
    console.error("[FCM] Error dispatching role-based order notifications:", err.message);
  }
};

module.exports = {
  initFirebase,
  registerFcmToken,
  unregisterFcmToken,
  sendNewOrderNotification,
};
