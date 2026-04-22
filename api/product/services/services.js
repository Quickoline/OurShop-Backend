const Product = require("../model/model");
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

const createProductService = async (data) => {
    if (data.title) {
        data.slug = slugify(data.title, { lower: true, strict: true });
    }
    applyDynamicDiscountFields(data);
    return await Product.create(data);
};

const getAllProductsService = async (queryParams = {}) => {
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
    if (isBestSeller !== undefined) filter.isBestSeller = isBestSeller === 'true';
    if (isNewlyLaunched !== undefined) filter.isNewlyLaunched = isNewlyLaunched === 'true';
    if (isMegaOffer !== undefined) filter.isMegaOffer = isMegaOffer === 'true';
    if (isCombo !== undefined) filter.isCombo = isCombo === 'true';
    if (isActive !== undefined) filter.isActive = isActive === 'true';


    if(minPrice || maxPrice) {
        filter.price = {};
        if(minPrice) filter.price.$gte = Number(minPrice);
        if(maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (search) {
        filter.$text = { $search: search };
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const products = await Product.find(filter)
    .populate("category", "name slug")
    .populate("subcategory", "name slug")
    .populate("brand", "name slug logo")
    .sort(sort)
    .skip(skip)
    .limit(Number(limit));

    const total = await Product.countDocuments(filter);

    return {
        products,
        pagination: {
            currentPage: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
            totalProducts: total,
            hasNextPage: Number(page) < Math.ceil(total / Number(limit)),
            hasPrevPage: Number(page) > 1,
        },
    };
};

const getProductByIdService = async (id) => {
    return await Product.findById(id)
        .populate("category", "name slug")
        .populate("subcategory", "name slug")
        .populate("brand", "name slug logo");   
};

const getProductBySlugService = async (slugOrId) => {
    const lookup = String(slugOrId || "").trim();
    if (!lookup) return null;

    const bySlug = await Product.findOne({ slug: lookup.toLowerCase() })
        .populate("category", "name slug")
        .populate("subcategory", "name slug")
        .populate("brand", "name slug logo");

    if (bySlug) return bySlug;

    if (mongoose.Types.ObjectId.isValid(lookup)) {
        return await Product.findById(lookup)
            .populate("category", "name slug")
            .populate("subcategory", "name slug")
            .populate("brand", "name slug logo");
    }

    return null;
};

const updateProductService = async (id, data) => {
    if (data.title) {
        data.slug = slugify(data.title, { lower: true, strict: true });
    }
    applyDynamicDiscountFields(data);
    return await Product.findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true,
    })
    .populate("category", "name slug")
    .populate("subcategory", "name slug")
    .populate("brand", "name slug logo");
};

const deleteProductService = async (id) => {
    return await Product.findByIdAndDelete(id);
};

const getBestSellerProductsService = async (limit = 10) => {
    return await Product.find({ isBestSeller: true, isActive: true })
    .populate("category", "name slug")
    .populate("brand", "name slug logo")
    .limit(Number(limit));
};

const getNewlylaunchedProductsService = async (limit = 10) => {
    return await Product.find({ isNewlyLaunched: true, isActive: true })
    .populate("category", "name slug")
    .populate("brand", "name slug logo")
    .limit(Number(limit));
};

const getMegaOfferProductsService = async(limit = 10) => {
  return await Product.find({ isMegaOffer: true, isActive: true })
    .populate("category", "name slug")
    .populate("brand", "name slug logo")
    .limit(Number(limit));
};

const getProductsByCategoryService = async (categoryId, queryParams = {}) => {
const  { page = 1, limit = 10, sort = "-createdAt" } = queryParams;
const skip = (Number(page) - 1) * Number(limit);

const products = await Product.find({ category: categoryId, isActive: true })
  .populate("subcategory", "name slug")
  .populate("brand", "name slug logo")
  .sort(sort)
  .skip(skip)
  .limit(Number(limit));

  const total = await Product.countDocuments({
    category: categoryId, isActive: true });

    return {
        products,
        pagination: {
            currentPage: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
            totalProducts: total,
        },
    };
};

const getRelatedProductsService = async (productId, limit = 6) => {
    const product = await Product.findById(productId);
    if (!product) return [];

    return await Product.find({
        _id: { $ne: productId },
        category: product.category,
        isActive: true,
    })
    .populate("brand","name slug logo")
    .limit(Number(limit));
};

const updateProductStockService = async (id, quantity, operation = "decrease") => {
    const product = await Product.findById(id);
    if (!product) return null;

    if (operation === "decrease") {
        product.quantity -= quantity;
        product.sold += quantity;
    } else {
        product.quantity += quantity;
    }

    await product.save();
    return product;
};

 const searchProductsService = async(searchQuery, limit = 20) => {
    return await Product.find({
        $text: { $search: searchQuery },
        isActive: true,
    })
    .select("title slug imgCover price priceAfterDiscount discountPercentage")
    .limit(Number(limit));
 };
  
module.exports = {
    createProductService,
    getAllProductsService,
    getProductByIdService,
    getProductBySlugService,
    updateProductService,
    deleteProductService,
    getBestSellerProductsService,
    getNewlylaunchedProductsService,
    getMegaOfferProductsService,
    getProductsByCategoryService,
    getRelatedProductsService,
    updateProductStockService,
    searchProductsService
};