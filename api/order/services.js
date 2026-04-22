const mongoose = require("mongoose");
const Model = require("./model");
const Product = require("../product/model/model");

// CREATE ORDER (invoice auto-generate)
const create = async (body) => {
  // auto invoice number
  body.invoiceNumber = `INV-${Date.now()}`;

  const orderItems = Array.isArray(body.orderItems) ? body.orderItems : [];
  if (!orderItems.length) {
    throw new Error("Order must contain at least one item");
  }

  for (const item of orderItems) {
    const productId = item.product || item.productId;
    const product = await Product.findById(productId);
    if (!product || product.isActive === false) {
      throw new Error("One or more products are unavailable");
    }
    const requestedQty = Number(item.quantity || 1);
    if (requestedQty > Number(product.quantity || 0)) {
      throw new Error(`${product.title} is out of stock`);
    }
  }

  for (const item of orderItems) {
    const productId = item.product || item.productId;
    const requestedQty = Number(item.quantity || 1);
    await Product.findByIdAndUpdate(productId, {
      $inc: { quantity: -requestedQty, sold: requestedQty },
    });
  }

  return await Model.create(body);
};

// ASSIGN DELIVERY PARTNER & TRACKING
const assignDelivery = async (id, deliveryData) => {
  /*
    deliveryData = {
      deliveryPartner,
      trackingId,
      expectedDeliveryDate
    }
  */

  return await Model.findByIdAndUpdate(
    id,
    {
      deliveryPartner: deliveryData.deliveryPartner,
      trackingId: deliveryData.trackingId,
      expectedDeliveryDate: deliveryData.expectedDeliveryDate,
      orderStatus: "SHIPPED",
    },
    { new: true }
  );
};

// GET SINGLE ORDER
const getone = async (id) => {
  return await Model.findById(id)
    .populate("user", "name email")
    .populate("orderItems.product", "title price image");
};

// GET ALL ORDERS
const getAll = async () => {
  return await Model.find({}).sort({ createdAt: -1 });
};

const getByUser = async (userId) => {
  const isValidObjectId = mongoose.Types.ObjectId.isValid(userId);
  const query = isValidObjectId
    ? { $or: [{ user: new mongoose.Types.ObjectId(userId) }, { user: userId }] }
    : { user: userId };

  return await Model.find(query).sort({ createdAt: -1 });
};

// UPDATE ORDER (generic)
const update = async (body, id) => {
  return await Model.findByIdAndUpdate(id, body, { new: true });
};

// UPDATE EXPECTED DELIVERY DATE ONLY
const updateExpectedDelivery = async (id, date) => {
  return await Model.findByIdAndUpdate(
    id,
    { expectedDeliveryDate: date },
    { new: true }
  );
};

// DELETE ORDER
const deleteone = async (id) => {
  return await Model.findByIdAndDelete(id);
};

// DELETE ALL ORDERS
const deleteAll = async () => {
  return await Model.deleteMany({});
};

module.exports = {
  create,
  assignDelivery,
  getone,
  getAll,
  getByUser,
  update,
  updateExpectedDelivery,
  deleteone,
  deleteAll,
};
