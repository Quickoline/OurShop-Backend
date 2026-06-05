const {
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
    searchProductsService
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

const parseProductBody = (body) => {
    const parsed = { ...body };
    const numberFields = ["price", "priceAfterDiscount", "profitAmount", "quantity", "sold"];
    const booleanFields = ["isBestSeller", "isNewlyLaunched", "isMegaOffer", "isCombo", "isActive"];

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
    if (parsed.ingredients !== undefined) parsed.ingredients = parseMaybeJsonArray(parsed.ingredients);
    if (parsed.aboutItems !== undefined) parsed.aboutItems = parseMaybeJsonArray(parsed.aboutItems);
    if (parsed.aboutItem !== undefined) parsed.aboutItems = parseMaybeJsonArray(parsed.aboutItem);
    if (parsed.specifications !== undefined) parsed.specifications = parseMaybeJsonObjectArray(parsed.specifications);
    if (parsed.sizeOptions !== undefined) parsed.sizeOptions = parseMaybeJsonObjectArray(parsed.sizeOptions);
    if (parsed.useBy !== undefined && parsed.useBy !== "") parsed.useBy = new Date(parsed.useBy);

    return parsed;
};

const createProduct = async (req, res) => {
    try {
        const payload = parseProductBody(req.body);
        const imgCoverFile = req.files?.imgCover?.[0];
        const imageFiles = req.files?.images || [];

        if (!imgCoverFile) {
            return res.status(400).json({
                success: false,
                message: "Product cover image (imgCover) is required.",
            });
        }

        payload.imgCover = await uploadBufferToS3({
            buffer: imgCoverFile.buffer,
            mimeType: imgCoverFile.mimetype,
            keyPrefix: "products/covers",
        });

        payload.images = await Promise.all(
            imageFiles.map((file) =>
                uploadBufferToS3({
                    buffer: file.buffer,
                    mimeType: file.mimetype,
                    keyPrefix: "products/gallery",
                })
            )
        );

        const product = await createProductService(payload);
        res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: product,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message});
    }
};

const getAllProducts = async (req, res) => {
    try{
        const result = await getAllProductsService(req.query);
        res.status(200).json({
            success: true,
            data: result.products,
            pagination: result.pagination,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message});
    }
};

const getProductById = async (req, res) => {
    try {
        const product = await getProductByIdService(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }
        res.status(200).json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getProductBySlug = async (req, res) => {
    try {
        const product = await getProductBySlugService(req.params.slug);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }
        res.status(200).json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateProduct = async (req, res) => {
    try {
        const payload = parseProductBody(req.body);
        const imgCoverFile = req.files?.imgCover?.[0];
        const imageFiles = req.files?.images || [];

        if (imgCoverFile) {
            payload.imgCover = await uploadBufferToS3({
                buffer: imgCoverFile.buffer,
                mimeType: imgCoverFile.mimetype,
                keyPrefix: "products/covers",
            });
        }

        if (imageFiles.length) {
            payload.images = await Promise.all(
                imageFiles.map((file) =>
                    uploadBufferToS3({
                        buffer: file.buffer,
                        mimeType: file.mimetype,
                        keyPrefix: "products/gallery",
                    })
                )
            );
        }

        const product = await updateProductService(req.params.id, payload);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }
        res.status(200).json({ 
        success: true,
        message: "Product updated successfully",
        data: product,
         });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const product = await deleteProductService(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }
        res.status(200).json({
            success: true,
            message: "Product deleted successfully",
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getBestSellerProducts = async (req, res) => {
    try{
        const { limit } = req.query;
        const products = await getBestSellerProductsService(limit);
        res.status(200).json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getNewlyLaunchedProducts = async (req,res) => {
    try{
        const { limit } = req.query;
        const products = await getNewlylaunchedProductsService(limit);
        res.status(200).json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getMegaOfferProducts = async (req,res) => {
    try{
        const { limit } = req.query;
        const products = await getMegaOfferProductsService(limit);
        res.status(200).json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getProductsByCategory = async (req, res) => {
    try {
        const result = await getProductsByCategoryService(
            req.params.categoryId,
            req.query
        );
        res.status(200).json({
            success: true,
            data: result.products,
            pagination: result.pagination,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getRelatedProducts = async (req, res) => {
    try {
        const { limit } = req.query;
        const products = await getRelatedProductsService(req.params.id, limit);
        res.status(200).json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message});
    }
};

const searchProducts = async (req, res) => {
    try {
        const { q, limit } = req.query;
        if (!q) {
            return res.status(400).json({
                success: false,
                message: "Search query is required",
            });
        }
     const products = await searchProductsService(q, limit);
     res.status(200).json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createProduct,
    getAllProducts,
    getProductById,
    getProductBySlug,
    updateProduct,
    deleteProduct,
    getBestSellerProducts,
    getNewlyLaunchedProducts,
    getMegaOfferProducts,
    getProductsByCategory,
    getRelatedProducts,
    searchProducts,
};