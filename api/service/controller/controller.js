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
const { uploadMedia } = require("../../../services/mediaStorageService");
const { normalizeJwtSubjectId } = require("../../../auth/auth");
const jwt = require("jsonwebtoken");
const User = require("../../user/model/model");

const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret";

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
    if (parsed[field] !== undefined && parsed[field] !== "" && parsed[field] !== null) {
      const num = Number(parsed[field]);
      parsed[field] = Number.isFinite(num) ? num : 0;
    } else if (parsed[field] === "" || parsed[field] === null) {
      parsed[field] = 0;
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

  // Support camelCase subCategory or empty/null subcategory
  if (parsed.subCategory !== undefined) {
    if (parsed.subCategory && parsed.subCategory !== "null" && parsed.subCategory !== "undefined") {
      parsed.subcategory = parsed.subCategory;
    }
    delete parsed.subCategory;
  }
  if (parsed.subcategory === "" || parsed.subcategory === "null" || parsed.subcategory === "undefined" || !parsed.subcategory) {
    parsed.subcategory = null;
  }
  if (parsed.brand === "" || parsed.brand === "null" || parsed.brand === "undefined" || !parsed.brand) {
    parsed.brand = null;
  }

  return parsed;
};

const createService = async (req, res) => {
  try {
    const payload = parseServiceBody(req.body);
    const imgCoverFile = req.files?.imgCover?.[0];
    const imageFiles = req.files?.images || [];
    const videoFiles = req.files?.videos || (req.files?.video ? [req.files.video[0]] : []);

    if (!imgCoverFile) {
      return res.status(400).json({
        success: false,
        message: "Service cover image (imgCover) is required.",
      });
    }

    const coverResult = await uploadMedia({
      buffer: imgCoverFile.buffer,
      originalname: imgCoverFile.originalname,
      mimetype: imgCoverFile.mimetype,
      folder: "services/covers",
    });
    payload.imgCover = coverResult.url;

    if (imageFiles.length) {
      const galleryResults = await Promise.all(
        imageFiles.map((file) =>
          uploadMedia({
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            folder: "services/gallery",
          })
        )
      );
      payload.images = galleryResults.map((r) => r.url);
    }

    if (videoFiles.length) {
      const videoResults = await Promise.all(
        videoFiles.map((file) =>
          uploadMedia({
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            folder: "services/videos",
          })
        )
      );
      payload.videos = videoResults.map((r) => r.url);
      if (payload.videos.length > 0) {
        payload.videoCover = payload.videos[0];
      }
    } else if (
      req.body.deleteVideo === "true" ||
      req.body.deleteVideo === true ||
      req.body.removeVideo === "true" ||
      req.body.removeVideo === true ||
      payload.deleteVideo
    ) {
      payload.videos = [];
      payload.videoCover = "";
    }

    // Auto-assign vendor for vendors, allow setting for superadmins
    if (req.user?.role === "vendor") {
      payload.vendor = req.user.id;
    } else if (req.user?.role === "admin" && req.body.vendor) {
      payload.vendor = req.body.vendor;
    }

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
    const query = { ...req.query };

    // Handle optional auth checks for vendor listing scoping
    const authHeader = req.headers.authorization || "";
    const [, token] = authHeader.split(" ");
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const subjectId = normalizeJwtSubjectId(decoded);
        if (subjectId) {
          const user = await User.findById(subjectId);
          if (user && user.role === "vendor") {
            query.vendor = String(user._id);
          }
        }
      } catch (e) {
        // ignore and continue
      }
    }

    const result = await getAllServicesService(query);
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
    const videoFiles = req.files?.videos || (req.files?.video ? [req.files.video[0]] : []);

    const existingService = await getServiceByIdService(req.params.id);
    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Vendor ownership check
    if (req.user?.role === "vendor" && String(existingService.vendor || "") !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You do not own this service.",
      });
    }

    if (imgCoverFile) {
      const coverResult = await uploadMedia({
        buffer: imgCoverFile.buffer,
        originalname: imgCoverFile.originalname,
        mimetype: imgCoverFile.mimetype,
        folder: "services/covers",
      });
      payload.imgCover = coverResult.url;
    }

    if (imageFiles.length) {
      const galleryResults = await Promise.all(
        imageFiles.map((file) =>
          uploadMedia({
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            folder: "services/gallery",
          })
        )
      );
      payload.images = galleryResults.map((r) => r.url);
    }

    if (videoFiles.length) {
      const videoResults = await Promise.all(
        videoFiles.map((file) =>
          uploadMedia({
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            folder: "services/videos",
          })
        )
      );
      payload.videos = videoResults.map((r) => r.url);
      if (payload.videos.length > 0) {
        payload.videoCover = payload.videos[0];
      }
    } else if (
      req.body.deleteVideo === "true" ||
      req.body.deleteVideo === true ||
      req.body.removeVideo === "true" ||
      req.body.removeVideo === true ||
      payload.deleteVideo
    ) {
      payload.videos = [];
      payload.videoCover = "";
    }

    // Vendors cannot change vendor field
    if (req.user?.role === "vendor") {
      delete payload.vendor;
    } else if (req.user?.role === "admin" && req.body.vendor) {
      payload.vendor = req.body.vendor;
    }

    delete payload.deleteVideo;
    delete payload.removeVideo;

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
    const existingService = await getServiceByIdService(req.params.id);
    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Vendor ownership check
    if (req.user?.role === "vendor" && String(existingService.vendor || "") !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You do not own this service.",
      });
    }

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
