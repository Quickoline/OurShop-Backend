require("dotenv").config();
const mongoose = require("mongoose");
const slugify = require("slugify");
const connectDB = require("../config/db");

const Category = require("../api/category/model");
const Brand = require("../api/brand/model");
const Product = require("../api/product/model/model");

const DETAILED_PRODUCT_TITLE = "Carbamide Forte Salmon Omega 3 Fish Oil Capsules";

const ensureCategory = async () => {
  const name = "Supplements";
  const slug = "supplements";
  let category = await Category.findOne({ slug });
  if (category) return category;

  category = await Category.create({
    name,
    slug,
    description: "Nutrition and supplement products for daily fitness goals.",
    isActive: true,
    showInNav: true,
  });
  return category;
};

const ensureBrand = async () => {
  const name = "Carbamide Forte";
  let brand = await Brand.findOne({ name });
  if (brand) return brand;

  brand = await Brand.create({
    name,
    description: "Premium wellness supplements for daily health support.",
    country: "India",
    isFeatured: true,
    isActive: true,
  });
  return brand;
};

const createOrUpdateDetailedProduct = async () => {
  const category = await ensureCategory();
  const brand = await ensureBrand();

  const payload = {
    title: DETAILED_PRODUCT_TITLE,
    slug: slugify(DETAILED_PRODUCT_TITLE, { lower: true, strict: true }),
    description:
      "Omega-3 fish oil supplement sourced from wild fish, designed for heart, joint, skin, and general wellness support.",
    price: 995,
    priceAfterDiscount: 749,
    quantity: 180,
    unit: "pack",
    category: category._id,
    subcategory: category._id,
    brand: brand._id,
    imgCover:
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1579722821273-0f6c1d44362f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1590059390043-c5d2c6b2f7f0?auto=format&fit=crop&w=1200&q=80",
    ],
    tags: ["bestseller", "mega_offer"],
    isBestSeller: true,
    isMegaOffer: true,
    isActive: true,
    soldBy: "Carbamide Forte Official",
    useBy: new Date("2026-07-01T00:00:00.000Z"),
    benefits: [
      "Supports heart health",
      "Supports joint comfort",
      "Helps maintain healthy skin",
      "Supports overall wellness",
    ],
    ingredients: ["Salmon Fish Oil", "EPA", "DHA", "Softgel Capsule Shell"],
    howToUse: "Take 1 capsule daily after meals or as directed by a healthcare professional.",
    aboutItems: [
      "Omega-3 capsules for men and women sourced from wild fish using sustainable practices.",
      "Mercury-free fish oil formula with non-GMO salmon oil and no krill oil.",
      "Rich in EPA and DHA to support heart health and omega-3 index.",
      "Non-enteric coated softgels for better digestion and absorption.",
      "4-in-1 daily support for heart, joints, bones, and skin health.",
    ],
    specifications: [
      { group: "Measurements", key: "Unit Count", value: "150 Count" },
      { group: "Measurements", key: "Item Weight", value: "240 Grams" },
      { group: "Measurements", key: "Item Dimensions", value: "7 x 7 x 13 Centimeters" },
      { group: "Measurements", key: "Number of Items", value: "1" },
      { group: "Features & Specs", key: "Brand", value: "Carbamide Forte" },
      { group: "Features & Specs", key: "Flavour", value: "Unflavoured" },
      { group: "Features & Specs", key: "Primary Supplement Type", value: "Omega-3" },
      { group: "Features & Specs", key: "Item Form", value: "Softgel" },
      { group: "Features & Specs", key: "Special Ingredients", value: "Fish Oil" },
      { group: "Materials & Care", key: "Material Features", value: "GMO Free" },
      { group: "Materials & Care", key: "Material Type Free", value: "GMO Free" },
      { group: "User Guide", key: "Allergen Information", value: "Soy Free" },
      { group: "Additional Details", key: "Country of Origin", value: "India" },
      {
        group: "Additional Details",
        key: "Manufacturer",
        value: "Novus Life Sciences Pvt. Ltd., Andheri (West), Mumbai-400053",
      },
      {
        group: "Additional Details",
        key: "Generic Name",
        value: "Salmon fish oil capsules",
      },
    ],
    sizeOptions: [
      { label: "60 count (Pack of 1)", price: 339, mrp: 540, perUnitPrice: 5.65, savingsPercent: 37, isDefault: false },
      { label: "90 count (Pack of 1)", price: 525, mrp: 695, perUnitPrice: 5.83, savingsPercent: 24, isDefault: false },
      { label: "120 count (Pack of 1)", price: 599, mrp: 695, perUnitPrice: 4.99, savingsPercent: 14, isDefault: false },
      { label: "150 count (Pack of 1)", price: 749, mrp: 995, perUnitPrice: 4.99, savingsPercent: 25, isDefault: true },
      { label: "150 count (Pack of 3)", price: 2135, mrp: 2985, perUnitPrice: 4.74, savingsPercent: 28, isDefault: false },
    ],
    metaTitle: "Carbamide Forte Omega 3 Fish Oil 150 Count",
    metaDescription:
      "Buy Carbamide Forte Salmon Omega 3 Fish Oil Capsules with EPA and DHA support for heart, joint, and skin health.",
  };

  const existing = await Product.findOne({
    $or: [{ title: DETAILED_PRODUCT_TITLE }, { slug: payload.slug }],
  });

  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    return { product: existing, action: "updated" };
  }

  const product = await Product.create(payload);
  return { product, action: "created" };
};

const run = async () => {
  try {
    await connectDB();
    const { product, action } = await createOrUpdateDetailedProduct();
    console.log(`Detailed product ${action} successfully.`);
    console.log(`Product ID: ${product._id}`);
    console.log(`Title: ${product.title}`);
    console.log(`Slug: ${product.slug}`);
  } catch (error) {
    console.error("Detailed product seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
