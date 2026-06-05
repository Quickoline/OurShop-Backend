const mongoose = require("mongoose");
const Model = require("./model");
const Product = require("../product/model/model");
const Service = require("../service/model/model");

const resolveItemType = (item) => {
  if (item.itemType === "service" || item.service || item.serviceId) {
    return "service";
  }
  return "product";
};

const resolveItemRefId = (item, itemType) => {
  if (itemType === "service") {
    return item.service || item.serviceId;
  }
  return item.product || item.productId;
};

// CREATE ORDER (invoice auto-generate)
const create = async (body) => {
  body.invoiceNumber = `INV-${Date.now()}`;

  const orderItems = Array.isArray(body.orderItems) ? body.orderItems : [];
  if (!orderItems.length) {
    throw new Error("Order must contain at least one item");
  }

  for (const item of orderItems) {
    const itemType = resolveItemType(item);
    const refId = resolveItemRefId(item, itemType);
    const requestedQty = Number(item.quantity || 1);

    if (!refId) {
      throw new Error("Each order item must reference a product or service");
    }

    if (itemType === "service") {
      const service = await Service.findById(refId);
      if (!service || service.isActive === false) {
        throw new Error("One or more services are unavailable");
      }
      const capacity = Number(service.capacity || 0);
      if (capacity > 0 && requestedQty > capacity) {
        throw new Error(`${service.title} has no available slots`);
      }
      item.itemType = "service";
      item.service = refId;
      item.product = undefined;
      item.profitAmount = Number(service.profitAmount || 0);
    } else {
      const product = await Product.findById(refId);
      if (!product || product.isActive === false) {
        throw new Error("One or more products are unavailable");
      }
      if (requestedQty > Number(product.quantity || 0)) {
        throw new Error(`${product.title} is out of stock`);
      }
      item.itemType = "product";
      item.product = refId;
      item.service = undefined;
      item.profitAmount = Number(product.profitAmount || 0);
    }
  }

  for (const item of orderItems) {
    const itemType = resolveItemType(item);
    const refId = resolveItemRefId(item, itemType);
    const requestedQty = Number(item.quantity || 1);

    if (itemType === "service") {
      const service = await Service.findById(refId);
      const capacity = Number(service?.capacity || 0);
      if (capacity > 0) {
        await Service.findByIdAndUpdate(refId, {
          $inc: { capacity: -requestedQty, booked: requestedQty },
        });
      } else {
        await Service.findByIdAndUpdate(refId, {
          $inc: { booked: requestedQty },
        });
      }
    } else {
      await Product.findByIdAndUpdate(refId, {
        $inc: { quantity: -requestedQty, sold: requestedQty },
      });
    }
  }

  return await Model.create(body);
};

const assignDelivery = async (id, deliveryData) => {
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

const getone = async (id) => {
  return await Model.findById(id)
    .populate("user", "name email")
    .populate("orderItems.product", "title price imgCover slug")
    .populate("orderItems.service", "title price imgCover slug duration");
};

const getAll = async () => {
  return await Model.find({}).sort({ createdAt: -1 });
};

const getByUser = async (userId) => {
  const isValidObjectId = mongoose.Types.ObjectId.isValid(userId);
  const query = isValidObjectId
    ? { $or: [{ user: new mongoose.Types.ObjectId(userId) }, { user: userId }] }
    : { user: userId };

  return await Model.find(query)
    .populate("orderItems.product", "title price imgCover slug")
    .populate("orderItems.service", "title price imgCover slug duration")
    .sort({ createdAt: -1 });
};

const { distributeOrderCommissions } = require("../mlm/distribute");

const tryMlmDistribution = async (orderId) => {
  const result = await distributeOrderCommissions(orderId);
  if (result?.distributed) return { ok: true, result };
  if (result?.skipped) {
    return { ok: false, result, message: `MLM skipped: ${result.reason}` };
  }
  return { ok: false, result, message: "MLM distribution did not run" };
};

const update = async (body, id) => {
  const payload = { ...body };
  if (payload.orderStatus === "DELIVERED" && !payload.deliveredAt) {
    payload.deliveredAt = new Date();
  }

  const updated = await Model.findByIdAndUpdate(id, payload, { new: true });
  if (!updated) return null;

  const needsMlm =
    updated.orderStatus === "DELIVERED" && !updated.commissionDistributed;

  if (needsMlm) {
    const mlm = await tryMlmDistribution(updated._id);
    const fresh = await Model.findById(id);
    if (fresh) fresh._mlm = mlm;
    return fresh;
  }

  return updated;
};

const updateExpectedDelivery = async (id, date) => {
  return await Model.findByIdAndUpdate(
    id,
    { expectedDeliveryDate: date },
    { new: true }
  );
};

const deleteone = async (id) => {
  return await Model.findByIdAndDelete(id);
};

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
