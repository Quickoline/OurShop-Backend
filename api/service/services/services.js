const Service = require("../model/model");
const slugify = require("slugify");
const mongoose = require("mongoose");

const applyDynamicDiscountFields = (data = {}) => {
  if (!data) return data;
  const price = Number(data.price);
  const hasPrice = Number.isFinite(price) && price > 0;

  const hasPriceAfterDiscount =
    data.priceAfterDiscount !== undefined &&
    data.priceAfterDiscount !== null &&
    data.priceAfterDiscount !== "" &&
    Number.isFinite(Number(data.priceAfterDiscount));

  const hasDiscountPercentage =
    data.discountPercentage !== undefined &&
    data.discountPercentage !== null &&
    data.discountPercentage !== "" &&
    Number.isFinite(Number(data.discountPercentage));

  if (!hasPrice) return data;

  if (hasPriceAfterDiscount) {
    const pad = Math.max(0, Math.min(price, Number(data.priceAfterDiscount)));
    data.priceAfterDiscount = pad;
    data.discountPercentage = Math.round(((price - pad) / price) * 100);
    return data;
  }

  if (hasDiscountPercentage) {
    const pct = Math.max(0, Math.min(100, Number(data.discountPercentage)));
    data.discountPercentage = pct;
    data.priceAfterDiscount = Number((price - (price * pct) / 100).toFixed(2));
    return data;
  }

  data.priceAfterDiscount = price;
  data.discountPercentage = 0;
  return data;
};

const createServiceService = async (data) => {
  if (data.title) {
    data.slug = slugify(data.title, { lower: true, strict: true });
  }
  applyDynamicDiscountFields(data);
  return await Service.create(data);
};

const getAllServicesService = async (queryParams = {}) => {
  const {
    page = 1,
    limit = 10,
    sort = "createdAt",
    category,
    subcategory,
    brand,
    minPrice,
    maxPrice,
    isBestSeller,
    isFeatured,
    isNewlyLaunched,
    isMegaOffer,
    isCombo,
    isActive,
    search,
  } = queryParams;

  const filter = {};
  if (category) filter.category = category;
  if (subcategory) filter.subcategory = subcategory;
  if (brand) filter.brand = brand;
  if (isBestSeller !== undefined) filter.isBestSeller = isBestSeller === "true";
  if (isFeatured !== undefined) filter.isFeatured = isFeatured === "true";
  if (isNewlyLaunched !== undefined) filter.isNewlyLaunched = isNewlyLaunched === "true";
  if (isMegaOffer !== undefined) filter.isMegaOffer = isMegaOffer === "true";
  if (isCombo !== undefined) filter.isCombo = isCombo === "true";
  if (isActive !== undefined) filter.isActive = isActive === "true";

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  if (search) {
    filter.$text = { $search: search };
  }

  const skip = (Number(page) - 1) * Number(limit);

  const services = await Service.find(filter)
    .populate("category", "name slug")
    .populate("subcategory", "name slug")
    .populate("brand", "name slug logo")
    .sort(sort)
    .skip(skip)
    .limit(Number(limit));

  const total = await Service.countDocuments(filter);

  return {
    services,
    pagination: {
      currentPage: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      totalServices: total,
      hasNextPage: Number(page) < Math.ceil(total / Number(limit)),
      hasPrevPage: Number(page) > 1,
    },
  };
};

const getServiceByIdService = async (id) => {
  return await Service.findById(id)
    .populate("category", "name slug")
    .populate("subcategory", "name slug")
    .populate("brand", "name slug logo");
};

const getServiceBySlugService = async (slugOrId) => {
  const lookup = String(slugOrId || "").trim();
  if (!lookup) return null;

  const bySlug = await Service.findOne({ slug: lookup.toLowerCase() })
    .populate("category", "name slug")
    .populate("subcategory", "name slug")
    .populate("brand", "name slug logo");

  if (bySlug) return bySlug;

  if (mongoose.Types.ObjectId.isValid(lookup)) {
    return await Service.findById(lookup)
      .populate("category", "name slug")
      .populate("subcategory", "name slug")
      .populate("brand", "name slug logo");
  }

  return null;
};

const updateServiceService = async (id, data) => {
  if (data.title) {
    data.slug = slugify(data.title, { lower: true, strict: true });
  }
  applyDynamicDiscountFields(data);
  return await Service.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  })
    .populate("category", "name slug")
    .populate("subcategory", "name slug")
    .populate("brand", "name slug logo");
};

const deleteServiceService = async (id) => {
  return await Service.findByIdAndDelete(id);
};

const getFeaturedServicesService = async (limit = 10) => {
  return await Service.find({
    isActive: true,
    $or: [{ isFeatured: true }, { isBestSeller: true }],
  })
    .populate("category", "name slug")
    .populate("brand", "name slug logo")
    .limit(Number(limit));
};

const getBestSellerServicesService = async (limit = 10) => {
  return await Service.find({ isBestSeller: true, isActive: true })
    .populate("category", "name slug")
    .populate("brand", "name slug logo")
    .limit(Number(limit));
};

const getNewlyLaunchedServicesService = async (limit = 10) => {
  return await Service.find({ isNewlyLaunched: true, isActive: true })
    .populate("category", "name slug")
    .populate("brand", "name slug logo")
    .limit(Number(limit));
};

const getMegaOfferServicesService = async (limit = 10) => {
  return await Service.find({ isMegaOffer: true, isActive: true })
    .populate("category", "name slug")
    .populate("brand", "name slug logo")
    .limit(Number(limit));
};

const getServicesByCategoryService = async (categoryId, queryParams = {}) => {
  const { page = 1, limit = 10, sort = "-createdAt" } = queryParams;
  const skip = (Number(page) - 1) * Number(limit);

  const services = await Service.find({ category: categoryId, isActive: true })
    .populate("subcategory", "name slug")
    .populate("brand", "name slug logo")
    .sort(sort)
    .skip(skip)
    .limit(Number(limit));

  const total = await Service.countDocuments({
    category: categoryId,
    isActive: true,
  });

  return {
    services,
    pagination: {
      currentPage: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      totalServices: total,
    },
  };
};

const getRelatedServicesService = async (serviceId, limit = 6) => {
  const service = await Service.findById(serviceId);
  if (!service) return [];

  return await Service.find({
    _id: { $ne: serviceId },
    category: service.category,
    isActive: true,
  })
    .populate("brand", "name slug logo")
    .limit(Number(limit));
};

const searchServicesService = async (searchQuery, limit = 20) => {
  return await Service.find({
    $text: { $search: searchQuery },
    isActive: true,
  })
    .select(
      "title slug imgCover price priceAfterDiscount discountPercentage duration capacity"
    )
    .limit(Number(limit));
};

module.exports = {
  createServiceService,
  getAllServicesService,
  getServiceByIdService,
  getServiceBySlugService,
  updateServiceService,
  deleteServiceService,
  getFeaturedServicesService,
  getBestSellerServicesService,
  getNewlyLaunchedServicesService,
  getMegaOfferServicesService,
  getServicesByCategoryService,
  getRelatedServicesService,
  searchServicesService,
};
