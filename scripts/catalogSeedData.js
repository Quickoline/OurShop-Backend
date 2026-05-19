/** Catalog seed data (mirrors former frontend dummy catalog). */
const img = (id, w = 600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80`;

const categories = [
  { name: "Electronics", slug: "electronics", description: "Phones, audio, and smart gadgets", image: img("15261703733318-803941a6bf21"), showInNav: true, displayOrder: 1 },
  { name: "Fashion", slug: "fashion", description: "Clothing and accessories", image: img("1445205170230-053b83016050"), showInNav: true, displayOrder: 2 },
  { name: "Home & Living", slug: "home", description: "Decor, kitchen, and furniture", image: img("1586023492125-27b2c045efd7"), showInNav: true, displayOrder: 3 },
  { name: "Beauty", slug: "beauty", description: "Skincare, makeup, and care", image: img("1596462502278-27bfd4033488"), showInNav: true, displayOrder: 4 },
  { name: "Sports", slug: "sports", description: "Fitness and outdoor gear", image: img("1517836357463-29668312a413"), showInNav: true, displayOrder: 5 },
  { name: "Books", slug: "books", description: "Reads for every interest", image: img("1495444378710-a822be758398"), showInNav: false, displayOrder: 6 },
  { name: "Home Services", slug: "home-services", description: "Cleaning, repairs, and installation", image: img("1581578730548-2f4f54f84e8f"), showInNav: true, displayOrder: 7 },
  { name: "Professional", slug: "professional", description: "Consulting, design, and business services", image: img("1600880292203-757bb62b4daf"), showInNav: true, displayOrder: 8 },
  { name: "Wellness", slug: "wellness-services", description: "Fitness, spa, and personal care", image: img("1544367567-0f2fcb009e23"), showInNav: false, displayOrder: 9 },
];

const brands = [
  { name: "TechSound", slug: "techsound", description: "Audio and smart devices", country: "India", isFeatured: true },
  { name: "ActiveWear", slug: "activewear", description: "Sports and fitness gear", country: "India", isFeatured: true },
  { name: "HomeNest", slug: "homenest", description: "Home and kitchen essentials", country: "India", isFeatured: false },
  { name: "GlowBeauty", slug: "glowbeauty", description: "Skincare and beauty", country: "India", isFeatured: true },
  { name: "StyleCo", slug: "styleco", description: "Fashion and accessories", country: "India", isFeatured: false },
  { name: "ReadWell", slug: "readwell", description: "Books and media", country: "India", isFeatured: false },
  { name: "ServicePro", slug: "servicepro", description: "Trusted service partners", country: "India", isFeatured: true },
];

const products = [
  { title: "Wireless Noise-Cancelling Earbuds", categorySlug: "electronics", brandSlug: "techsound", price: 4999, priceAfterDiscount: 3499, quantity: 42, ratingAvg: 4.7, ratingCount: 328, isBestSeller: true, isMegaOffer: true, imgCover: img("1590658268037-6bf3fdad4514"), description: "Premium sound, 32-hour battery, and comfortable fit for all-day use." },
  { title: "Smart Fitness Watch Pro", categorySlug: "electronics", brandSlug: "techsound", price: 8999, priceAfterDiscount: 6749, quantity: 28, ratingAvg: 4.8, ratingCount: 512, isBestSeller: true, isNewlyLaunched: true, imgCover: img("1523275335684-37898b6baf30"), description: "Track health metrics, GPS, and notifications with a vibrant AMOLED display." },
  { title: "Organic Cotton Crew Tee", categorySlug: "fashion", brandSlug: "styleco", price: 1299, priceAfterDiscount: 899, quantity: 120, ratingAvg: 4.5, ratingCount: 89, isMegaOffer: true, imgCover: img("1521572163474-6864f9cf17ab"), description: "Soft organic cotton everyday tee in multiple colors." },
  { title: "Lightweight Running Shoes", categorySlug: "sports", brandSlug: "activewear", price: 4499, priceAfterDiscount: 3599, quantity: 35, ratingAvg: 4.6, ratingCount: 201, isBestSeller: true, imgCover: img("1542291026-7eec264c27ff"), description: "Breathable mesh upper with responsive cushioning for daily runs." },
  { title: "Ceramic Pour-Over Coffee Set", categorySlug: "home", brandSlug: "homenest", price: 2499, priceAfterDiscount: 1999, quantity: 18, ratingAvg: 4.9, ratingCount: 74, isNewlyLaunched: true, imgCover: img("1495474472287-4d776b657825"), description: "Brew barista-style coffee at home with dripper, carafe, and filters." },
  { title: "Hydrating Face Moisturizer SPF 30", categorySlug: "beauty", brandSlug: "glowbeauty", price: 1899, priceAfterDiscount: 1424, quantity: 64, ratingAvg: 4.7, ratingCount: 156, isBestSeller: true, isMegaOffer: true, imgCover: img("1556228720-195a672ede84"), description: "Lightweight daily moisturizer with broad-spectrum sun protection." },
  { title: "LED Desk Lamp with USB Charging", categorySlug: "home", brandSlug: "homenest", price: 2199, quantity: 50, ratingAvg: 4.4, ratingCount: 93, isNewlyLaunched: true, imgCover: img("1507473886341-189941329e45"), description: "Adjustable brightness desk lamp with built-in USB charging port." },
  { title: "Non-Slip Yoga Mat 6mm", categorySlug: "sports", brandSlug: "activewear", price: 1599, priceAfterDiscount: 1199, quantity: 88, ratingAvg: 4.8, ratingCount: 267, isBestSeller: true, imgCover: img("1601925265160-142a43e52d92"), description: "Extra grip TPE mat for yoga, pilates, and floor workouts." },
  { title: "Bluetooth Portable Speaker", categorySlug: "electronics", brandSlug: "techsound", price: 3299, priceAfterDiscount: 2309, quantity: 41, ratingAvg: 4.6, ratingCount: 189, isMegaOffer: true, imgCover: img("1608043152359-50704d7036e6"), description: "Water-resistant speaker with 12-hour playtime and deep bass." },
  { title: "Classic Denim Jacket", categorySlug: "fashion", brandSlug: "styleco", price: 3999, priceAfterDiscount: 2999, quantity: 22, ratingAvg: 4.5, ratingCount: 64, imgCover: img("1551028719-00167b16eac5"), description: "Timeless medium-wash denim jacket with durable stitching." },
  { title: "Skincare Essentials Gift Box", categorySlug: "beauty", brandSlug: "glowbeauty", price: 3499, priceAfterDiscount: 2799, quantity: 30, ratingAvg: 4.9, ratingCount: 118, isCombo: true, tags: ["combo", "gift"], imgCover: img("1571781926291-c477ebfd024b"), description: "Curated cleanser, serum, and moisturizer set — ideal for gifting." },
  { title: "Bestseller Fiction Hardcover Set", categorySlug: "books", brandSlug: "readwell", price: 2799, priceAfterDiscount: 2099, quantity: 15, ratingAvg: 4.7, ratingCount: 42, isCombo: true, tags: ["combo"], imgCover: img("1512820790816-752d3b9b8000"), description: "Collection of three acclaimed fiction titles in hardcover." },
  { title: "Stainless Steel Water Bottle 1L", categorySlug: "sports", brandSlug: "activewear", price: 999, quantity: 200, ratingAvg: 4.6, ratingCount: 340, isNewlyLaunched: true, imgCover: img("1602143407151-7111542de6e8"), description: "Insulated bottle keeps drinks cold 24h or hot 12h." },
  { title: "Wireless Charging Pad 15W", categorySlug: "electronics", brandSlug: "techsound", price: 1499, priceAfterDiscount: 1049, quantity: 75, ratingAvg: 4.4, ratingCount: 98, isMegaOffer: true, imgCover: img("1586816870464-531363b4b83b"), description: "Fast Qi wireless charger compatible with phones and earbuds case." },
  { title: "Aromatherapy Diffuser & Oil Kit", categorySlug: "home", brandSlug: "homenest", price: 2999, priceAfterDiscount: 2249, quantity: 26, ratingAvg: 4.8, ratingCount: 87, isCombo: true, tags: ["combo", "gift"], imgCover: img("1608571423902-eed4a5ad8108"), description: "Ultrasonic diffuser with essential oil starter set." },
  { title: "Polarized UV Protection Sunglasses", categorySlug: "fashion", brandSlug: "styleco", price: 1999, priceAfterDiscount: 1499, quantity: 48, ratingAvg: 4.5, ratingCount: 76, isNewlyLaunched: true, imgCover: img("1572635196237-14b490f1293a"), description: "Polarized lenses with lightweight frames for all-day comfort." },
];

const services = [
  { title: "Home Deep Cleaning (3 BHK)", categorySlug: "home-services", brandSlug: "servicepro", price: 3499, priceAfterDiscount: 2799, capacity: 99, ratingAvg: 4.8, ratingCount: 412, isBestSeller: true, isFeatured: true, duration: "4–5 hours", imgCover: img("1581578730548-2f4f54f84e8f"), description: "Professional deep clean for kitchen, bathrooms, and living areas. Supplies included." },
  { title: "AC Service & Gas Refill", categorySlug: "home-services", brandSlug: "servicepro", price: 1299, priceAfterDiscount: 999, capacity: 99, ratingAvg: 4.7, ratingCount: 289, isMegaOffer: true, duration: "90 min", imgCover: img("1621905252507-b9f4c92f4a1b"), description: "Complete AC servicing with filter clean and gas top-up." },
  { title: "Business Consultation (1 Hour)", categorySlug: "professional", brandSlug: "servicepro", price: 2499, capacity: 99, ratingAvg: 4.9, ratingCount: 156, isNewlyLaunched: true, duration: "60 min", imgCover: img("1600880292203-757bb62b4daf"), description: "One-on-one session with a certified business advisor — strategy, ops, or growth." },
  { title: "Logo & Brand Identity Design", categorySlug: "professional", brandSlug: "servicepro", price: 8999, priceAfterDiscount: 7199, capacity: 99, ratingAvg: 4.8, ratingCount: 98, isBestSeller: true, isFeatured: true, duration: "5–7 days", imgCover: img("1561070791-2526d309fc94"), description: "Logo, color palette, and brand guidelines delivered digitally." },
  { title: "Personal Training Session (60 min)", categorySlug: "wellness-services", brandSlug: "servicepro", price: 1499, capacity: 99, ratingAvg: 4.9, ratingCount: 203, isNewlyLaunched: true, duration: "60 min", imgCover: img("1571019614242-ef6cc81be2f8"), description: "Certified trainer — strength, cardio, or mobility focus." },
  { title: "Website Setup & Launch Package", categorySlug: "professional", brandSlug: "servicepro", price: 14999, priceAfterDiscount: 11999, capacity: 99, ratingAvg: 4.7, ratingCount: 67, isMegaOffer: true, duration: "2 weeks", imgCover: img("1460925895917-afdab827c52f"), description: "Domain, hosting setup, responsive site, and launch support." },
  { title: "Plumbing Visit & Repair", categorySlug: "home-services", brandSlug: "servicepro", price: 599, priceAfterDiscount: 449, capacity: 99, ratingAvg: 4.6, ratingCount: 534, duration: "60 min", imgCover: img("1581578730548-2f4f54f84e8f"), description: "Diagnosis and repair for leaks, taps, and fittings." },
  { title: "Spa & Relaxation Package", categorySlug: "wellness-services", brandSlug: "servicepro", price: 3999, priceAfterDiscount: 3199, capacity: 99, ratingAvg: 4.9, ratingCount: 178, isCombo: true, tags: ["combo"], duration: "2 hours", imgCover: img("1540550641-5413be9e8d48"), description: "Massage, facial, and aromatherapy session at partner spa." },
];

module.exports = { categories, brands, products, services };
