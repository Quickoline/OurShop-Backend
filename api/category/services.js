const slugify = require("slugify");
const Category = require("../category/model");

const sanitizeCategoryInput = (data = {}) => {
  const payload = {};

  if (data.name !== undefined) {
    payload.name = String(data.name).trim();
  }
  if (data.showInNav !== undefined) {
    payload.showInNav = Boolean(data.showInNav);
  }
  if (data.isActive !== undefined) {
    payload.isActive = Boolean(data.isActive);
  }

  return payload;
};

const withSlug = (data) => {
  if (!data.name) return data;
  return {
    ...data,
    slug: slugify(data.name, { lower: true, strict: true }),
  };
};

const createCategoryService = async (data) => {
  const payload = withSlug(sanitizeCategoryInput(data));
  if (!payload.name) {
    throw new Error("Category name is required.");
  }
  return await Category.create(payload);
};

const getAllCategoriesService = async () => {
  return await Category.find().sort("createdAt");
};

const getActiveCategoriesService = async () => {
  return await Category.find({ isActive: true, showInNav: true }).sort("createdAt");
};

const getCategoryByIdService = async (id) => {
  return await Category.findById(id);
};

const getCategoryBySlugService = async (slug) => {
  return await Category.findOne({ slug });
};

const updateCategoryService = async (id, data) => {
  const payload = withSlug(sanitizeCategoryInput(data));
  return await Category.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });
};

const deleteCategoryService = async (id) => {
  return await Category.findByIdAndDelete(id);
};

module.exports = {
  createCategoryService,
  getAllCategoriesService,
  getActiveCategoriesService,
  getCategoryByIdService,
  getCategoryBySlugService,
  updateCategoryService,
  deleteCategoryService,
};
