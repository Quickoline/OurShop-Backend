const {
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
} = require("../services/services");
const { uploadBufferToS3 } = require("../../../config/s3");

const parseMaybeJsonArray = (value) => {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const parseMaybeJsonObjectArray = (value) => {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseServiceBody = (body) => {
  const parsed = { ...body };
  const numberFields = [
    "price",
    "priceAfterDiscount",
    "profitAmount",
    "capacity",
    "booked",
    "discountPercentage",
  ];
  const booleanFields = [
    "isBestSeller",
    "isFeatured",
    "isNewlyLaunched",
    "isMegaOffer",
    "isCombo",
    "isActive",
  ];

  numberFields.forEach((field) => {
    if (parsed[field] !== undefined && parsed[field] !== "") {
      parsed[field] = Number(parsed[field]);
    }
  });

  booleanFields.forEach((field) => {
    if (parsed[field] !== undefined) {
      parsed[field] = String(parsed[field]) === "true";
    }
  });

  if (parsed.tags !== undefined) parsed.tags = parseMaybeJsonArray(parsed.tags);
  if (parsed.benefits !== undefined) parsed.benefits = parseMaybeJsonArray(parsed.benefits);
  if (parsed.aboutItems !== undefined) parsed.aboutItems = parseMaybeJsonArray(parsed.aboutItems);
  if (parsed.specifications !== undefined) {
    parsed.specifications = parseMaybeJsonObjectArray(parsed.specifications);
  }

  return parsed;
};

const createService = async (req, res) => {
  try {
    const payload = parseServiceBody(req.body);
    const imgCoverFile = req.files?.imgCover?.[0];
    const imageFiles = req.files?.images || [];

    if (!imgCoverFile) {
      return res.status(400).json({
        success: false,
        message: "Service cover image (imgCover) is required.",
      });
    }

    payload.imgCover = await uploadBufferToS3({
      buffer: imgCoverFile.buffer,
      mimeType: imgCoverFile.mimetype,
      keyPrefix: "services/covers",
    });

    payload.images = await Promise.all(
      imageFiles.map((file) =>
        uploadBufferToS3({
          buffer: file.buffer,
          mimeType: file.mimetype,
          keyPrefix: "services/gallery",
        })
      )
    );

    const service = await createServiceService(payload);
    res.status(201).json({
      success: true,
      message: "Service created successfully",
      data: service,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllServices = async (req, res) => {
  try {
    const result = await getAllServicesService(req.query);
    res.status(200).json({
      success: true,
      data: result.services,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getServiceById = async (req, res) => {
  try {
    const service = await getServiceByIdService(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }
    res.status(200).json({ success: true, data: service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getServiceBySlug = async (req, res) => {
  try {
    const service = await getServiceBySlugService(req.params.slug);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }
    res.status(200).json({ success: true, data: service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateService = async (req, res) => {
  try {
    const payload = parseServiceBody(req.body);
    const imgCoverFile = req.files?.imgCover?.[0];
    const imageFiles = req.files?.images || [];

    if (imgCoverFile) {
      payload.imgCover = await uploadBufferToS3({
        buffer: imgCoverFile.buffer,
        mimeType: imgCoverFile.mimetype,
        keyPrefix: "services/covers",
      });
    }

    if (imageFiles.length) {
      payload.images = await Promise.all(
        imageFiles.map((file) =>
          uploadBufferToS3({
            buffer: file.buffer,
            mimeType: file.mimetype,
            keyPrefix: "services/gallery",
          })
        )
      );
    }

    const service = await updateServiceService(req.params.id, payload);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Service updated successfully",
      data: service,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteService = async (req, res) => {
  try {
    const service = await deleteServiceService(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getFeaturedServices = async (req, res) => {
  try {
    const { limit } = req.query;
    const services = await getFeaturedServicesService(limit);
    res.status(200).json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getBestSellerServices = async (req, res) => {
  try {
    const { limit } = req.query;
    const services = await getBestSellerServicesService(limit);
    res.status(200).json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getNewlyLaunchedServices = async (req, res) => {
  try {
    const { limit } = req.query;
    const services = await getNewlyLaunchedServicesService(limit);
    res.status(200).json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMegaOfferServices = async (req, res) => {
  try {
    const { limit } = req.query;
    const services = await getMegaOfferServicesService(limit);
    res.status(200).json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getServicesByCategory = async (req, res) => {
  try {
    const result = await getServicesByCategoryService(
      req.params.categoryId,
      req.query
    );
    res.status(200).json({
      success: true,
      data: result.services,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRelatedServices = async (req, res) => {
  try {
    const { limit } = req.query;
    const services = await getRelatedServicesService(req.params.id, limit);
    res.status(200).json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const searchServices = async (req, res) => {
  try {
    const { q, limit } = req.query;
    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }
    const services = await searchServicesService(q, limit);
    res.status(200).json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createService,
  getAllServices,
  getServiceById,
  getServiceBySlug,
  updateService,
  deleteService,
  getFeaturedServices,
  getBestSellerServices,
  getNewlyLaunchedServices,
  getMegaOfferServices,
  getServicesByCategory,
  getRelatedServices,
  searchServices,
};
