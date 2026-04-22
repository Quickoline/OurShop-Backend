require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");

const User = require("../api/user/model/model");
const Category = require("../api/category/model");
const Brand = require("../api/brand/model");
const Product = require("../api/product/model/model");
const Coupon = require("../api/coupon/model");
const Review = require("../api/review/model");
const Order = require("../api/order/model");
const Cart = require("../api/cart/model");
const Wishlist = require("../api/wishlist/model");

const clearCollections = async () => {
  await Promise.all([
    Review.deleteMany({}),
    Order.deleteMany({}),
    Cart.deleteMany({}),
    Wishlist.deleteMany({}),
    Coupon.deleteMany({}),
    Product.deleteMany({}),
    Brand.deleteMany({}),
    Category.deleteMany({}),
    User.deleteMany({}),
  ]);
};

const seedData = async () => {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@123";
  const userPassword = process.env.SEED_USER_PASSWORD || "User@123";

  const [admin, userOne, userTwo] = await User.create([
    {
      name: "Super Admin",
      email: "admin@shop.com",
      password: adminPassword,
      role: "admin",
      verified: true,
      isActive: true,
    },
    {
      name: "Rahul Kumar",
      email: "rahul@shop.com",
      password: userPassword,
      role: "user",
      verified: true,
      isActive: true,
      addresses: [
        {
          city: "Bengaluru",
          street: "MG Road",
          state: "Karnataka",
          pincode: "560001",
          phone: "9876543210",
        },
      ],
    },
    {
      name: "Priya Singh",
      email: "priya@shop.com",
      password: userPassword,
      role: "user",
      verified: true,
      isActive: true,
      addresses: [
        {
          city: "Hyderabad",
          street: "Banjara Hills",
          state: "Telangana",
          pincode: "500034",
          phone: "9123456780",
        },
      ],
    },
  ]);

  const [categoryOne, categoryTwo] = await Category.create([
    {
      name: "Supplements",
      slug: "supplements",
      description: "Nutrition and supplement products for daily fitness goals.",
      isActive: true,
      showInNav: true,
    },
    {
      name: "Equipment",
      slug: "equipment",
      description: "Workout accessories and equipment for home and gym use.",
      isActive: true,
      showInNav: true,
    },
  ]);

  const [brandOne, brandTwo] = await Brand.create([
    {
      name: "PowerFuel",
      description: "Premium quality sports nutrition brand.",
      country: "India",
      isFeatured: true,
      isActive: true,
    },
    {
      name: "FitCore",
      description: "Trusted fitness equipment and wellness products.",
      country: "India",
      isFeatured: false,
      isActive: true,
    },
  ]);

  const [productOne, productTwo, productThree, productFour] = await Product.create([
    {
      title: "Whey Protein Isolate 1kg",
      description: "High purity whey isolate for muscle recovery and lean strength gain.",
      price: 2999,
      priceAfterDiscount: 2499,
      quantity: 120,
      unit: "pcs",
      category: categoryOne._id,
      subcategory: categoryOne._id,
      brand: brandOne._id,
      tags: ["bestseller"],
      isBestSeller: true,
      benefits: ["Fast absorption", "High protein per serving"],
      ingredients: ["Whey isolate", "Natural flavors", "Stevia"],
      howToUse: "Mix one scoop with water after workout.",
      isActive: true,
    },
    {
      title: "Mass Gainer Advanced 2kg",
      description: "Calorie dense formula for healthy weight gain and performance energy.",
      price: 3499,
      priceAfterDiscount: 3199,
      quantity: 80,
      unit: "pcs",
      category: categoryOne._id,
      subcategory: categoryOne._id,
      brand: brandOne._id,
      tags: ["mega_offer"],
      isMegaOffer: true,
      benefits: ["High calorie blend", "Added creatine support"],
      ingredients: ["Protein blend", "Complex carbs", "Vitamins"],
      howToUse: "Blend two scoops with milk between meals.",
      isActive: true,
    },
    {
      title: "Yoga Mat Pro Grip",
      description: "Non slip yoga mat with extra cushioning for comfort and joint safety.",
      price: 1499,
      priceAfterDiscount: 1199,
      quantity: 200,
      unit: "pcs",
      category: categoryTwo._id,
      subcategory: categoryTwo._id,
      brand: brandTwo._id,
      tags: ["newly_launched"],
      isNewlyLaunched: true,
      benefits: ["Anti slip surface", "Easy to clean material"],
      ingredients: ["TPE"],
      howToUse: "Use on flat floor for yoga and stretching sessions.",
      isActive: true,
    },
    {
      title: "Resistance Band Set",
      description: "Multiple resistance levels for strength training and mobility workouts.",
      price: 999,
      priceAfterDiscount: 799,
      quantity: 250,
      unit: "set",
      category: categoryTwo._id,
      subcategory: categoryTwo._id,
      brand: brandTwo._id,
      tags: ["combo"],
      isCombo: true,
      benefits: ["Portable", "Progressive resistance levels"],
      ingredients: ["Latex"],
      howToUse: "Choose a band level and perform pull or stretch sets.",
      isActive: true,
    },
  ]);

  userOne.wishlist = [productOne._id, productThree._id];
  userTwo.wishlist = [productTwo._id];
  await Promise.all([userOne.save(), userTwo.save()]);

  await Wishlist.create([
    {
      userId: userOne._id,
      products: [{ productId: productOne._id }, { productId: productThree._id }],
    },
    {
      userId: userTwo._id,
      products: [{ productId: productTwo._id }],
    },
  ]);

  const cartOne = new Cart({
    userId: userOne._id,
    cartItems: [
      {
        productId: productOne._id,
        quantity: 1,
        price: productOne.price,
        priceAfterDiscount: productOne.priceAfterDiscount,
      },
      {
        productId: productFour._id,
        quantity: 2,
        price: productFour.price,
        priceAfterDiscount: productFour.priceAfterDiscount,
      },
    ],
  });
  cartOne.calculateTotals();
  await cartOne.save();

  await Coupon.create([
    {
      code: "WELCOME10",
      description: "Flat welcome discount for first orders.",
      discountType: "percentage",
      discountValue: 10,
      minOrderValue: 999,
      maxDiscount: 500,
      isNewUserOnly: true,
      usageLimit: 200,
      usageLimitPerUser: 1,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90),
      applicableCategories: [categoryOne._id],
      applicableProducts: [productOne._id, productTwo._id],
      isActive: true,
    },
    {
      code: "FIT200",
      description: "Fixed 200 off on selected accessories.",
      discountType: "fixed",
      discountValue: 200,
      minOrderValue: 1000,
      usageLimit: 500,
      usageLimitPerUser: 2,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120),
      applicableCategories: [categoryTwo._id],
      applicableProducts: [productThree._id, productFour._id],
      isActive: true,
    },
  ]);

  await Review.create([
    {
      title: "Excellent quality",
      text: "Very effective protein. Mixes well and helped my recovery.",
      productId: productOne._id,
      userId: userOne._id,
      rate: 5,
      isActive: true,
    },
    {
      title: "Great for home workouts",
      text: "Bands are strong and useful for daily full body sessions.",
      productId: productFour._id,
      userId: userTwo._id,
      rate: 4,
      isActive: true,
    },
  ]);

  await Order.create([
    {
      user: userOne._id,
      orderItems: [
        {
          product: productOne._id,
          title: productOne.title,
          Discription: productOne.description,
          quantity: 1,
          price: productOne.priceAfterDiscount,
        },
        {
          product: productFour._id,
          title: productFour.title,
          Discription: productFour.description,
          quantity: 2,
          price: productFour.priceAfterDiscount,
        },
      ],
      shippingAddress: {
        fullName: "Rahul Kumar",
        phone: 9876543210,
        addressLine: "MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: 560001,
        country: "India",
      },
      itemsPrice: productOne.priceAfterDiscount + productFour.priceAfterDiscount * 2,
      taxPrice: 120,
      shippingPrice: 60,
      discountPrice: 100,
      totalPrice: productOne.priceAfterDiscount + productFour.priceAfterDiscount * 2 + 80,
      paymentMethod: "COD",
      isPaid: false,
      orderStatus: "PLACED",
      invoiceNumber: `INV-${Date.now()}`,
    },
    {
      user: userTwo._id,
      orderItems: [
        {
          product: productThree._id,
          title: productThree.title,
          Discription: productThree.description,
          quantity: 1,
          price: productThree.priceAfterDiscount,
        },
      ],
      shippingAddress: {
        fullName: "Priya Singh",
        phone: 9123456780,
        addressLine: "Banjara Hills",
        city: "Hyderabad",
        state: "Telangana",
        pincode: 500034,
        country: "India",
      },
      itemsPrice: productThree.priceAfterDiscount,
      taxPrice: 40,
      shippingPrice: 40,
      discountPrice: 0,
      totalPrice: productThree.priceAfterDiscount + 80,
      paymentMethod: "UPI",
      isPaid: true,
      paymentResult: {
        transactionId: `TXN-${Date.now()}`,
        status: "success",
        paidAt: new Date(),
      },
      orderStatus: "CONFIRMED",
      invoiceNumber: `INV-${Date.now() + 1}`,
    },
  ]);

  console.log("Seed completed.");
  console.log("Admin login:");
  console.log("email: admin@shop.com");
  console.log(`password: ${adminPassword}`);
  console.log("User login examples:");
  console.log("rahul@shop.com / " + userPassword);
  console.log("priya@shop.com / " + userPassword);
};

const run = async () => {
  const resetOnly = process.argv.includes("--reset");

  try {
    await connectDB();
    await clearCollections();

    if (resetOnly) {
      console.log("All seed collections cleared.");
      return;
    }

    await seedData();
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
