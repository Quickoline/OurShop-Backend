const mongoose = require("mongoose");
const services = require("./services");
const { normalizeJwtSubjectId } = require("../../auth/auth");
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
    const data = await services.getAll();

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
    const body = req.body;

    const data = await services.update(body, id);
    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Error updating order",
      details: err.message,
    });
  }
};

// ================= ASSIGN DELIVERY DETAILS =================
const assignDelivery = async (req, res) => {
  try {
    const id = req.params.id;
    const { deliveryPartner, trackingId, expectedDeliveryDate } = req.body;

    const data = await services.update(
      {
        deliveryPartner,
        trackingId,
        expectedDeliveryDate,
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
