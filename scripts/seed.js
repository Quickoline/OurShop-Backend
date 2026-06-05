require("dotenv").config();
const mongoose = require("mongoose");
const slugify = require("slugify");
const connectDB = require("../config/db");

const User = require("../api/user/model/model");
const Category = require("../api/category/model");
const Brand = require("../api/brand/model");
const Product = require("../api/product/model/model");
const Service = require("../api/service/model/model");
const Coupon = require("../api/coupon/model");
const Review = require("../api/review/model");
const Order = require("../api/order/model");
const WalletTransaction = require("../api/wallet/model");
const { distributeOrderCommissions } = require("../api/mlm/distribute");
const Cart = require("../api/cart/model");
const Wishlist = require("../api/wishlist/model");

const { categories, brands, products, services } = require("./catalogSeedData");

const clearCollections = async () => {
  await Promise.all([
    Review.deleteMany({}),
    Order.deleteMany({}),
    WalletTransaction.deleteMany({}),
    Cart.deleteMany({}),
    Wishlist.deleteMany({}),
    Coupon.deleteMany({}),
    Product.deleteMany({}),
    Service.deleteMany({}),
    Brand.deleteMany({}),
    Category.deleteMany({}),
    User.deleteMany({}),
  ]);
};

const seedData = async () => {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@123";
  const userPassword = process.env.SEED_USER_PASSWORD || "User@123";

  const admin = await User.create({
    name: "Super Admin",
    email: "admin@shop.com",
    password: adminPassword,
    role: "admin",
    verified: true,
    isActive: true,
    referralCode: "HEADADMIN",
  });

  const userOne = await User.create({
      name: "Rahul Kumar",
      email: "rahul@shop.com",
      password: userPassword,
      role: "user",
      verified: true,
      isActive: true,
      referralCode: "RAHUL01",
      addresses: [
        {
          city: "Bengaluru",
          street: "MG Road",
          state: "Karnataka",
          pincode: "560001",
          phone: "9876543210",
        },
      ],
  });

  const userTwo = await User.create({
      name: "Priya Singh",
      email: "priya@shop.com",
      password: userPassword,
      role: "user",
      verified: true,
      isActive: true,
      sponsor: userOne._id,
      referralCode: "PRIYA01",
      addresses: [
        {
          city: "Hyderabad",
          street: "Banjara Hills",
          state: "Telangana",
          pincode: "500034",
          phone: "9123456780",
        },
      ],
  });

  const categoryDocs = await Category.insertMany(
    categories.map((c) => ({
      ...c,
      isActive: true,
    }))
  );
  const categoryBySlug = Object.fromEntries(
    categoryDocs.map((c) => [c.slug, c])
  );

  const brandDocs = await Brand.insertMany(
    brands.map((b) => ({
      ...b,
      isActive: true,
    }))
  );
  const brandBySlug = Object.fromEntries(brandDocs.map((b) => [b.slug, b]));

  const productDocs = await Product.insertMany(
    products.map((p) => {
      const cat = categoryBySlug[p.categorySlug];
      const brand = brandBySlug[p.brandSlug];
      return {
        title: p.title,
        slug: slugify(p.title, { lower: true, strict: true }),
        description: p.description,
        price: p.price,
        priceAfterDiscount: p.priceAfterDiscount ?? p.price,
        profitAmount: p.profitAmount ?? Math.round((p.priceAfterDiscount ?? p.price) * 0.25),
        quantity: p.quantity,
        unit: "pcs",
        imgCover: p.imgCover,
        images: p.images || [],
        category: cat._id,
        subcategory: cat._id,
        brand: brand._id,
        tags: p.tags || [],
        isBestSeller: !!p.isBestSeller,
        isNewlyLaunched: !!p.isNewlyLaunched,
        isMegaOffer: !!p.isMegaOffer,
        isCombo: !!p.isCombo,
        ratingAvg: p.ratingAvg ?? 0,
        ratingCount: p.ratingCount ?? 0,
        isActive: true,
      };
    })
  );

  const serviceDocs = await Service.insertMany(
    services.map((s) => {
      const cat = categoryBySlug[s.categorySlug];
      const brand = brandBySlug[s.brandSlug];
      return {
        title: s.title,
        slug: slugify(s.title, { lower: true, strict: true }),
        description: s.description,
        price: s.price,
        priceAfterDiscount: s.priceAfterDiscount ?? s.price,
        profitAmount: s.profitAmount ?? Math.round((s.priceAfterDiscount ?? s.price) * 0.25),
        capacity: s.capacity ?? 0,
        booked: 0,
        duration: s.duration,
        unit: "session",
        imgCover: s.imgCover,
        images: s.images || [],
        category: cat._id,
        subcategory: cat._id,
        brand: brand._id,
        tags: s.tags || (s.isFeatured ? ["featured"] : []),
        isBestSeller: !!s.isBestSeller,
        isFeatured: !!s.isFeatured || !!s.isBestSeller,
        isNewlyLaunched: !!s.isNewlyLaunched,
        isMegaOffer: !!s.isMegaOffer,
        isCombo: !!s.isCombo,
        ratingAvg: s.ratingAvg ?? 0,
        ratingCount: s.ratingCount ?? 0,
        isActive: true,
      };
    })
  );

  const [productOne, productTwo, productThree] = productDocs;
  const [serviceOne, serviceTwo] = serviceDocs;

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
        itemType: "product",
        productId: productOne._id,
        quantity: 1,
        price: productOne.price,
        priceAfterDiscount: productOne.priceAfterDiscount,
      },
      {
        itemType: "service",
        serviceId: serviceOne._id,
        quantity: 1,
        price: serviceOne.price,
        priceAfterDiscount: serviceOne.priceAfterDiscount,
      },
    ],
  });
  cartOne.calculateTotals();
  await cartOne.save();

  const electronicsCat = categoryBySlug.electronics;
  const homeServicesCat = categoryBySlug["home-services"];

  await Coupon.create([
    {
      code: "WELCOME10",
      description: "10% off your first order",
      discountType: "percentage",
      discountValue: 10,
      minOrderValue: 999,
      maxDiscount: 500,
      isNewUserOnly: true,
      usageLimit: 500,
      usageLimitPerUser: 1,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90),
      applicableCategories: [electronicsCat._id],
      isActive: true,
    },
    {
      code: "SAVE200",
      description: "Flat ₹200 off orders above ₹1999",
      discountType: "fixed",
      discountValue: 200,
      minOrderValue: 1999,
      usageLimit: 500,
      usageLimitPerUser: 3,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120),
      isActive: true,
    },
  ]);

  await Review.create([
    {
      title: "Great sound",
      text: "Earbuds are comfortable and battery lasts all day.",
      productId: productOne._id,
      userId: userOne._id,
      rate: 5,
      isActive: true,
    },
    {
      title: "Perfect for runs",
      text: "Running shoes are light and supportive.",
      productId: productDocs[3]._id,
      userId: userTwo._id,
      rate: 5,
      isActive: true,
    },
  ]);

  const seededOrders = await Order.create([
    {
      user: userOne._id,
      orderItems: [
        {
          itemType: "product",
          product: productOne._id,
          title: productOne.title,
          Discription: productOne.description,
          image: productOne.imgCover,
          quantity: 1,
          price: productOne.priceAfterDiscount,
          profitAmount: productOne.profitAmount || 0,
        },
        {
          itemType: "product",
          product: productTwo._id,
          title: productTwo.title,
          Discription: productTwo.description,
          image: productTwo.imgCover,
          quantity: 1,
          price: productTwo.priceAfterDiscount,
          profitAmount: productTwo.profitAmount || 0,
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
      itemsPrice: productOne.priceAfterDiscount + productTwo.priceAfterDiscount,
      taxPrice: 0,
      shippingPrice: 0,
      discountPrice: 0,
      totalPrice: productOne.priceAfterDiscount + productTwo.priceAfterDiscount,
      paymentMethod: "RAZORPAY",
      isPaid: false,
      orderStatus: "PLACED",
      invoiceNumber: `INV-${Date.now()}`,
    },
    {
      user: userTwo._id,
      orderItems: [
        {
          itemType: "service",
          service: serviceOne._id,
          title: serviceOne.title,
          Discription: serviceOne.description,
          image: serviceOne.imgCover,
          quantity: 1,
          price: serviceOne.priceAfterDiscount,
        },
        {
          itemType: "service",
          service: serviceTwo._id,
          title: serviceTwo.title,
          Discription: serviceTwo.description,
          image: serviceTwo.imgCover,
          quantity: 1,
          price: serviceTwo.priceAfterDiscount,
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
      itemsPrice: serviceOne.priceAfterDiscount + serviceTwo.priceAfterDiscount,
      taxPrice: 0,
      shippingPrice: 0,
      discountPrice: 0,
      totalPrice: serviceOne.priceAfterDiscount + serviceTwo.priceAfterDiscount,
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
    {
      user: userTwo._id,
      orderItems: [
        {
          itemType: "product",
          product: productOne._id,
          title: productOne.title,
          quantity: 2,
          price: productOne.priceAfterDiscount,
          profitAmount: productOne.profitAmount || 0,
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
      itemsPrice: productOne.priceAfterDiscount * 2,
      taxPrice: 0,
      shippingPrice: 0,
      discountPrice: 0,
      totalPrice: productOne.priceAfterDiscount * 2,
      paymentMethod: "RAZORPAY",
      isPaid: true,
      paymentResult: {
        transactionId: `TXN-MLM-${Date.now()}`,
        status: "success",
        paidAt: new Date(),
      },
      orderStatus: "DELIVERED",
      invoiceNumber: `INV-MLM-${Date.now()}`,
      commissionDistributed: false,
    },
    {
      user: userTwo._id,
      orderItems: [
        {
          itemType: "service",
          service: serviceOne._id,
          title: serviceOne.title,
          quantity: 1,
          price: serviceOne.priceAfterDiscount,
          profitAmount: serviceOne.profitAmount || 0,
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
      itemsPrice: serviceOne.priceAfterDiscount,
      taxPrice: 0,
      shippingPrice: 0,
      discountPrice: 0,
      totalPrice: serviceOne.priceAfterDiscount,
      paymentMethod: "UPI",
      isPaid: true,
      orderStatus: "DELIVERED",
      deliveredAt: new Date(),
      invoiceNumber: `INV-MLM-SVC-${Date.now()}`,
      commissionDistributed: false,
    },
  ]);

  for (const mlmDemoOrder of seededOrders.filter((o) =>
    String(o.invoiceNumber || "").startsWith("INV-MLM")
  )) {
    try {
      const dist = await distributeOrderCommissions(mlmDemoOrder._id);
      console.log(`MLM demo (${mlmDemoOrder.invoiceNumber}):`, dist);
    } catch (err) {
      console.warn(`MLM demo skipped (${mlmDemoOrder.invoiceNumber}):`, err.message);
    }
  }

  console.log("Seed completed successfully.");
  console.log(`Categories: ${categoryDocs.length}`);
  console.log(`Brands: ${brandDocs.length}`);
  console.log(`Products: ${productDocs.length}`);
  console.log(`Services: ${serviceDocs.length}`);
  console.log("\nAdmin login: admin@shop.com / " + adminPassword);
  console.log("Users: rahul@shop.com, priya@shop.com / " + userPassword);
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
    if (error.stack) console.error(error.stack);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
