const {
    createCategoryService,
    getAllCategoriesService,
    getActiveCategoriesService, 
    getCategoryByIdService,
    getCategoryBySlugService,
    getSubcategoriesByParentService,
    updateCategoryService,
    deleteCategoryService,
} = require("../category/services");


const createCategory = async (req, res) => {
    try {
        const category = await createCategoryService(req.body);
        res.status(201).json({
            success: true,
            message: "Category created successfully",
            data: category,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
    };


    const getAllCategories = async (req, res) => {
        try {
            const categories = await getAllCategoriesService();
            res.status(200).json({ success: true, data: categories });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };


    const getActiveCategories = async (req, res) => {
        try {
            const categories = await getActiveCategoriesService();
            res.status(200).json({ success: true, data: categories });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };


    const getCategoryById = async (req, res) => {
        try {
            const category = await getCategoryByIdService(req.params.id);
            if (!category) {
                return res
                .status(404)
                .json({ success: false, message: "Category not found" });
            }
            res.status(200).json({ success: true, data: category });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };


    const getCategoryBySlug = async (req, res) => {
        try {
            const category = await getCategoryBySlugService(req.params.slug);
            if (!category) {
                return res
                .status(404)
                .json({ success: false, message: "Category not found" });
            }
            res.status(200).json({ success: true, data: category });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    const getSubcategoriesByParent = async (req, res) => {
        try {
            const categories = await getSubcategoriesByParentService(req.params.id);
            res.status(200).json({ success: true, data: categories });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };



    const updateCategory = async (req, res) => {
        try {
            const category = await updateCategoryService(req.params.id, req.body);
            if (!category) {
                return res 
                .status(404)
                .json({ success: false, message: "Category not found" });
            }
            res.status(200).json({
                success: true,
                message: "Category updated successfully",
                data: category,
            });
        } catch (error) {
          res.status(500).json({ success: false, message: error.message });
        }
    };


    const deleteCategory = async (req, res) => {
        try {
            await deleteCategoryService(req.params.id);
            res.status(200).json({
                success: true,
                message: "Category deleted successfully",
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    module.exports = {
        createCategory,
        getAllCategories,
        getActiveCategories,
        getCategoryById,
        getCategoryBySlug,
        getSubcategoriesByParent,
        updateCategory,
        deleteCategory,
    };
    