const mongoose = require("mongoose");
const services = require("./services");
const { normalizeJwtSubjectId } = require("../../auth/auth");
const { DeliveryWallet, DeliveryWalletTransaction } = require("../wallet/deliveryWalletModel");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret";

const resolveAuthenticatedUserId = (req) => {
  if (req.user?.id) return String(req.user.id);
  if (req.user?._id) return String(req.user._id);
  const authHeader = req.headers.authorization || "";
  const [, token] = authHeader.split(" ");
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return normalizeJwtSubjectId(decoded);
  } catch {
    return null;
  }
};

// ================= CREATE ORDER =================
const create = async (req, res) => {
  try {
    const userId = resolveAuthenticatedUserId(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to place an order.",
      });
    }

    const body = {
      ...req.body,
      // Always bind order to authenticated user (ignore client-supplied user).
      user: userId,
    };

    // Auto invoice number generate
    body.invoiceNumber = `INV-${Date.now()}`;

    const data = await services.create(body);

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Error creating order",
      details: err.message,
    });
  }
};

// ================= GET SINGLE ORDER =================
const getone = async (req, res) => {
  try {
    const id = req.params.id;

    const data = await services.getone(id);
    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // Role-based read authorization checks
    const role = req.user?.role;
    const userId = String(req.user?.id || "");

    if (role === "vendor") {
      const hasVendorItem = data.orderItems.some(
        (item) => item.vendor && String(item.vendor) === userId
      );
      if (!hasVendorItem) {
        return res.status(403).json({
          success: false,
          error: "Access denied. This order does not contain your products.",
        });
      }
    } else if (role === "delivery") {
      // delivery partner can view all orders
    } else if (role !== "admin" && String(data.user?._id || data.user) !== userId) {
      // Normal customers can only read their own orders
      return res.status(403).json({
        success: false,
        error: "Access denied.",
      });
    }

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Error fetching order",
      details: err.message,
    });
  }
};

// ================= GET ALL ORDERS =================
const getAll = async (req, res) => {
  try {
    const role = req.user?.role;
    const userId = String(req.user?.id || "");
    let filter = {};

    if (role === "vendor") {
      filter = { "orderItems.vendor": userId };
    } else if (role === "delivery") {
      filter = {}; // delivery partner can view all orders
    } else if (role !== "admin") {
      // Customers cannot list all orders, must use getMyOrders
      return res.status(403).json({
        success: false,
        error: "Access denied. Unauthorized role.",
      });
    }

    const data = await services.getAll(filter);

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Error fetching orders",
      details: err.message,
    });
  }
};

const getMyOrders = async (req, res) => {
  try {
    const data = await services.getByUser(req.user.id);
    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Error fetching your orders",
      details: err.message,
    });
  }
};

// ================= UPDATE ORDER (GENERIC) =================
const update = async (req, res) => {
  try {
    const id = req.params.id;
    const role = req.user?.role;
    const userId = String(req.user?.id || "");

    const order = await services.getone(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    let updatePayload = {};

    if (role === "admin") {
      // Superadmin can update anything
      updatePayload = req.body;
    } else if (role === "vendor") {
      // Vendor must own at least one item
      const hasVendorItem = order.orderItems.some(
        (item) => item.vendor && String(item.vendor) === userId
      );
      if (!hasVendorItem) {
        return res.status(403).json({
          success: false,
          error: "Access denied. You do not own items in this order.",
        });
      }

      if (req.body.orderStatus) {
        // Vendor must have status update write access
        if (!req.user?.isOrderAdmin) {
          return res.status(403).json({
            success: false,
            error: "Access denied. You do not have write access to order status (isOrderAdmin is disabled).",
          });
        }

        const allowedVendorStatuses = ["CONFIRMED", "PACKED", "SHIPPED", "CANCELLED"];
        if (!allowedVendorStatuses.includes(req.body.orderStatus)) {
          return res.status(403).json({
            success: false,
            error: `Vendors are not authorized to transition order status to ${req.body.orderStatus}.`,
          });
        }
        updatePayload.orderStatus = req.body.orderStatus;
      }

      if (req.body.deliveryPartnerEarning !== undefined) {
        if (!order.assignedDeliveryPartner) {
          return res.status(400).json({
            success: false,
            error: "Cannot set earning: no delivery partner is assigned to this order yet.",
          });
        }
        const earning = Number(req.body.deliveryPartnerEarning);
        if (isNaN(earning) || earning < 0) {
          return res.status(400).json({
            success: false,
            error: "Invalid delivery partner earning amount.",
          });
        }
        updatePayload.deliveryPartnerEarning = earning;

        // Perform delivery partner wallet credit transaction
        const oldEarning = Number(order.deliveryPartnerEarning || 0);
        const diff = earning - oldEarning;
        if (diff !== 0) {
          let wallet = await DeliveryWallet.findOne({ user: order.assignedDeliveryPartner });
          if (!wallet) {
            wallet = await DeliveryWallet.create({ user: order.assignedDeliveryPartner, balance: 0 });
          }
          wallet.balance = Number((wallet.balance + diff).toFixed(2));
          await wallet.save();

          await DeliveryWalletTransaction.create({
            user: order.assignedDeliveryPartner,
            amount: Math.abs(diff),
            type: diff > 0 ? "CREDIT" : "DEBIT",
            balanceAfter: wallet.balance,
            description: `Vendor updated earning for Order #${order.invoiceNumber || order._id}`,
            order: order._id,
          });
        }
      }

      if (Object.keys(updatePayload).length === 0) {
        return res.status(400).json({
          success: false,
          error: "No valid fields to update were provided (orderStatus or deliveryPartnerEarning).",
        });
      }
    } else if (role === "delivery") {
      // Delivery partner can update status on any order
      if (!req.body.orderStatus) {
        return res.status(400).json({
          success: false,
          error: "Delivery partner can only update orderStatus.",
        });
      }

      const allowedDeliveryStatuses = ["OUT_FOR_DELIVERY", "DELIVERED"];
      if (!allowedDeliveryStatuses.includes(req.body.orderStatus)) {
        return res.status(403).json({
          success: false,
          error: `Delivery partners are not authorized to transition order status to ${req.body.orderStatus}.`,
        });
      }

      updatePayload = { orderStatus: req.body.orderStatus };
    } else {
      return res.status(403).json({
        success: false,
        error: "Access denied.",
      });
    }

    // Perform auto credit if transitioning to DELIVERED
    if (updatePayload.orderStatus === "DELIVERED" && order.orderStatus !== "DELIVERED") {
      const totalOrderDeliveryCharges = order.orderItems.reduce((acc, item) => {
        if (item.itemType === "product" || item.product) {
          return acc + (Number(item.deliveryCharges || 0) * Number(item.quantity || 1));
        }
        return acc;
      }, 0);

      if (totalOrderDeliveryCharges > 0 && order.assignedDeliveryPartner) {
        let wallet = await DeliveryWallet.findOne({ user: order.assignedDeliveryPartner });
        if (!wallet) {
          wallet = await DeliveryWallet.create({ user: order.assignedDeliveryPartner, balance: 0 });
        }
        
        updatePayload.deliveryPartnerEarning = totalOrderDeliveryCharges;

        const oldEarning = Number(order.deliveryPartnerEarning || 0);
        const diff = totalOrderDeliveryCharges - oldEarning;
        if (diff !== 0) {
          wallet.balance = Number((wallet.balance + diff).toFixed(2));
          await wallet.save();

          await DeliveryWalletTransaction.create({
            user: order.assignedDeliveryPartner,
            amount: Math.abs(diff),
            type: diff > 0 ? "CREDIT" : "DEBIT",
            balanceAfter: wallet.balance,
            description: `Automatic delivery charges credited on order transition to DELIVERED`,
            order: order._id,
          });
        }
      }
    }

    const data = await services.update(updatePayload, id);
    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    let message = "Order updated successfully";
    if (data?._mlm?.ok) {
      message = "Order updated and MLM commissions distributed";
    } else if (data?._mlm?.message) {
      message = `Order updated. ${data._mlm.message}`;
    }

    res.status(200).json({
      success: true,
      message,
      data,
      mlm: data?._mlm || null,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Error updating order",
      message: err.message,
      details: err.message,
    });
  }
};

// ================= ASSIGN DELIVERY DETAILS =================
const assignDelivery = async (req, res) => {
  try {
    // Only Superadmin can assign delivery details
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Access denied. Only Superadmin can assign delivery partners.",
      });
    }

    const id = req.params.id;
    const { deliveryPartner, trackingId, expectedDeliveryDate, assignedDeliveryPartner } = req.body;

    const data = await services.update(
      {
        deliveryPartner,
        trackingId,
        expectedDeliveryDate,
        assignedDeliveryPartner: assignedDeliveryPartner || null,
        orderStatus: "SHIPPED",
      },
      id
    );

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Delivery details updated successfully",
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Error assigning delivery",
      details: err.message,
    });
  }
};

// ================= UPDATE EXPECTED DELIVERY DATE ONLY =================
const updateExpectedDeliveryDate = async (req, res) => {
  try {
    const id = req.params.id;
    const role = req.user?.role;
    const userId = String(req.user?.id || "");

    const order = await services.getone(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // Must be Admin or Delivery Partner
    if (role !== "admin" && role !== "delivery") {
      return res.status(403).json({
        success: false,
        error: "Access denied. You cannot modify the expected delivery date for this order.",
      });
    }

    const { expectedDeliveryDate } = req.body;

    const data = await services.update(
      { expectedDeliveryDate },
      id
    );

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Expected delivery date updated",
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Error updating delivery date",
      details: err.message,
    });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const id = req.params.id;
    const data = await services.update(
      { orderStatus: "CANCELLED" },
      id
    );

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Error cancelling order",
      details: err.message,
    });
  }
};

// ================= DELETE SINGLE ORDER =================
const deleteone = async (req, res) => {
  try {
    const id = req.params.id;

    const data = await services.deleteone(id);
    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Error deleting order",
      details: err.message,
    });
  }
};

// ================= DELETE ALL ORDERS =================
const deleteAll = async (req, res) => {
  try {
    await services.deleteAll();

    res.status(200).json({
      success: true,
      message: "All orders deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Error deleting all orders",
      details: err.message,
    });
  }
};

// ================= EXPORT =================
module.exports = {
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
};
