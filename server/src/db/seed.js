/**
 * Seed the database with: one user per role, the 8 categories, the 55 sample
 * products (mirroring the frontend mock data, some try-on enabled), the
 * customer's default address, and two sample orders with payments/deliveries.
 * Safe to re-run: clears the domain tables first (dev only).
 */
const bcrypt = require('bcryptjs');
const config = require('../config');
const { pool, withTransaction } = require('./index');

const img = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

const CATEGORIES = [
  { name: 'Electronics', slug: 'electronics', subcategories: ['Smartphones', 'Laptops', 'Headphones', 'Cameras', 'Smart Watches', 'Accessories'], description: 'Devices, gadgets, and everyday tech essentials.', icon: 'smartphone', image: img('photo-1519389950473-47ba0277781c') },
  { name: 'Clothing', slug: 'clothing', subcategories: ["Men's", "Women's", 'Kids', 'Shirts', 'T-Shirts', 'Dresses', 'Jackets', 'Jeans'], description: 'Everyday fashion with try-on support for selected items.', icon: 'shirt', image: img('photo-1489987707025-afc232f7ea0f') },
  { name: 'Home & Living', slug: 'home', subcategories: ['Furniture', 'Kitchen', 'Home Decor', 'Lighting', 'Storage'], description: 'Furniture, kitchenware, decor, lighting, and storage.', icon: 'home', image: img('photo-1513694203232-719a280e022f') },
  { name: 'Beauty', slug: 'beauty', subcategories: ['Skincare', 'Makeup', 'Hair Care', 'Personal Care'], description: 'Personal care products for daily routines.', icon: 'sparkles', image: img('photo-1596462502278-27bfdc403348') },
  { name: 'Sports', slug: 'sports', subcategories: ['Sportswear', 'Fitness Equipment', 'Outdoor Gear'], description: 'Gear for workouts, sports, and active weekends.', icon: 'dumbbell', image: img('photo-1517836357463-d25dfeac3438') },
  { name: 'Books', slug: 'books', subcategories: ['Books', 'School Supplies', 'Office Supplies'], description: 'Reading, learning, and stationery for school or work.', icon: 'book-open', image: img('photo-1495446815901-a7297e633e8d') },
  { name: 'Grocery', slug: 'grocery', subcategories: ['Food', 'Beverages', 'Household Essentials'], description: 'Pantry staples, drinks, and home essentials.', icon: 'shopping-basket', image: img('photo-1542838132-92c53300491e') },
  { name: 'Toys & More', slug: 'toys', subcategories: ['Toys', 'Gadgets', 'Pet Supplies', 'General Products'], description: 'Gifts, play, gadgets, pet items, and useful extras.', icon: 'puzzle', image: img('photo-1566576912321-d58ddd7a6088') }
];

const USERS = [
  { name: 'Maya Customer', email: 'customer@demo.com', password: 'password123', role: 'customer' },
  { name: 'Sam Seller', email: 'seller@demo.com', password: 'password123', role: 'seller', storeName: 'UrbanWear' },
  { name: 'Dev Delivery', email: 'delivery@demo.com', password: 'password123', role: 'delivery' },
  { name: 'Anika Admin', email: 'admin@demo.com', password: 'password123', role: 'admin' },
  // Additional sellers that own the seeded products (storefronts from the mock data)
  { name: 'TechSquare', email: 'techsquare@demo.com', password: 'password123', role: 'seller', storeName: 'TechSquare' },
  { name: 'AudioBay', email: 'audiobay@demo.com', password: 'password123', role: 'seller', storeName: 'AudioBay' },
  { name: 'GadgetLane', email: 'gadgetlane@demo.com', password: 'password123', role: 'seller', storeName: 'GadgetLane' },
  { name: 'StyleMarket', email: 'stylemarket@demo.com', password: 'password123', role: 'seller', storeName: 'StyleMarket' },
  { name: 'HomeWorks', email: 'homeworks@demo.com', password: 'password123', role: 'seller', storeName: 'HomeWorks' },
  { name: 'DailyHome', email: 'dailyhome@demo.com', password: 'password123', role: 'seller', storeName: 'DailyHome' },
  { name: 'GlowMart', email: 'glowmart@demo.com', password: 'password123', role: 'seller', storeName: 'GlowMart' },
  { name: 'ActiveZone', email: 'activezone@demo.com', password: 'password123', role: 'seller', storeName: 'ActiveZone' },
  { name: 'BookCorner', email: 'bookcorner@demo.com', password: 'password123', role: 'seller', storeName: 'BookCorner' },
  { name: 'FreshBasket', email: 'freshbasket@demo.com', password: 'password123', role: 'seller', storeName: 'FreshBasket' },
  { name: 'PlayPlus', email: 'playplus@demo.com', password: 'password123', role: 'seller', storeName: 'PlayPlus' }
];

// [name, price, originalPrice, category, subcategory, brand, stock, imageId, tryOn, flags, rating, reviews, productType]
const P = (name, price, originalPrice, category, subcategory, brand, stock, imageId, tryOn, flags, rating, reviews, productType, specs, tags) =>
  ({ name, price, originalPrice, category, subcategory, brand, stock, image: img(imageId), tryOn, ...flags, rating, reviews, productType, specs: specs || {}, tags: tags || [] });

const PRODUCTS = [
  P('Nova X5 Smartphone', 699, 799, 'Electronics', 'Smartphones', 'NovaTech', 42, 'photo-1511707171634-5f897ff02aa9', false, { isFeatured: true, isBestSeller: true }, 4.7, 1240, 'smartphone', { Storage: '256 GB', Display: '6.5 inch OLED', Warranty: '1 year' }, ['5G', 'OLED']),
  P('Ultrabook Pro 14', 1199, 1399, 'Electronics', 'Laptops', 'Aster', 18, 'photo-1496181133206-80ce9b88a853', false, { isFeatured: true }, 4.8, 860, 'laptop', { Processor: 'Core i7', RAM: '16 GB', Storage: '1 TB SSD' }, ['laptop', 'student']),
  P('Pulse Wireless Headphones', 179, 229, 'Electronics', 'Headphones', 'Pulse', 66, 'photo-1505740420928-5e560c06d30e', false, { isBestSeller: true }, 4.5, 530, 'headphones', { Battery: '35 hours', Connectivity: 'Bluetooth 5.3' }, ['audio', 'wireless']),
  P('Orbit Smart Watch', 249, 299, 'Electronics', 'Smart Watches', 'Orbit', 37, 'photo-1523275335684-37898b6baf30', false, { isNew: true }, 4.4, 421, 'watch', { Battery: '8 days', WaterResistance: '5 ATM' }, ['watch', 'fitness']),
  P('VividShot Mirrorless Camera', 899, null, 'Electronics', 'Cameras', 'VividShot', 12, 'photo-1516035069371-29a1b244cc32', false, {}, 4.6, 288, 'camera', { Sensor: 'APS-C', Video: '4K 60fps' }, ['camera', 'creator']),
  P('MagSafe Charging Stand', 49, null, 'Electronics', 'Accessories', 'Amply', 90, 'photo-1586953208448-b95a79798f07', false, {}, 4.2, 176, 'accessory', { Output: '15W', Material: 'Aluminum' }, ['charger']),
  P('DeskHub USB-C Dock', 89, 119, 'Electronics', 'Accessories', 'DeskHub', 51, 'photo-1625842268584-8f3296236761', false, {}, 4.3, 231, 'dock', { Ports: '9', Output: '4K HDMI' }, ['workstation']),
  P('HomePod Mini Speaker', 129, null, 'Electronics', 'Accessories', 'SonicHome', 34, 'photo-1545454675-3531b543be5d', false, {}, 4.1, 142, 'speaker', { Connectivity: 'Wi-Fi, Bluetooth', Voice: 'Assistant ready' }, ['speaker']),
  P('Arcade Gaming Keyboard', 99, 129, 'Electronics', 'Accessories', 'Arcade', 29, 'photo-1618384887929-16ec33fab9ef', false, { isBestSeller: true }, 4.7, 392, 'keyboard', { Switches: 'Brown', Layout: 'TKL' }, ['gaming']),
  P('ViewPoint 27 Monitor', 329, null, 'Electronics', 'Accessories', 'ViewPoint', 23, 'photo-1527443224154-c4a3942d3acf', false, {}, 4.6, 317, 'monitor', { Size: '27 inch', Resolution: 'QHD' }, ['monitor']),
  P('Everyday Cotton T-Shirt', 24, 32, 'Clothing', 'T-Shirts', 'North & Loom', 120, 'photo-1521572163474-6864f9cf17ab', true, { isFeatured: true }, 4.4, 715, 't-shirt', { Material: 'Cotton', Fit: 'Regular' }, ['cotton', 'casual']),
  P('Classic Denim Jeans', 59, 79, 'Clothing', 'Jeans', 'BlueForge', 74, 'photo-1542272604-787c3835535d', true, {}, 4.3, 489, 'jeans', { Material: 'Denim', Fit: 'Straight' }, ['denim']),
  P('Oxford Formal Shirt', 45, null, 'Clothing', 'Shirts', 'Arden', 53, 'photo-1596755094514-f87e34085b2c', true, {}, 4.5, 306, 'shirt', { Material: 'Cotton blend', Fit: 'Slim' }, ['formal']),
  P('Weekend Hoodie', 54, 70, 'Clothing', 'Jackets', 'Harbor', 39, 'photo-1556821840-3a63f95609a7', true, { isBestSeller: true }, 4.6, 512, 'hoodie', { Material: 'Fleece', Fit: 'Relaxed' }, ['hoodie']),
  P('Floral Midi Dress', 76, null, 'Clothing', 'Dresses', 'Elara', 28, 'photo-1515372039744-b8f02a3ae446', true, {}, 4.7, 274, 'dress', { Material: 'Viscose', Length: 'Midi' }, ['dress']),
  P('Rainproof Field Jacket', 119, 149, 'Clothing', 'Jackets', 'Trailmark', 20, 'photo-1543076447-215ad9ba6923', true, {}, 4.4, 211, 'jacket', { Shell: 'Water resistant', Pockets: '4' }, ['jacket']),
  P('Kids Graphic Tee Pack', 34, null, 'Clothing', 'Kids', 'TinyTrail', 88, 'photo-1503919545889-aef636e10ad4', false, {}, 4.2, 168, 'kids clothing', { Count: '3', Material: 'Cotton' }, ['kids']),
  P('Leather Crossbody Bag', 89, 110, 'Clothing', 'Fashion Accessories', 'Mira', 25, 'photo-1590874103328-eac38a683ce7', false, {}, 4.1, 135, 'accessory', { Material: 'Leather', Strap: 'Adjustable' }, ['bag']),
  P('Athletic Running Shoes', 112, 140, 'Clothing', 'Footwear', 'Stride', 46, 'photo-1542291026-7eec264c27ff', false, {}, 4.6, 697, 'footwear', { Cushioning: 'Responsive', Drop: '8 mm' }, ['shoes']),
  P('Traditional Kurta Set', 68, null, 'Clothing', 'Shirts', 'Rang', 31, 'photo-1597983073493-88cd35cf93b0', true, { isNew: true }, 4.5, 194, 'traditional clothing', { Material: 'Cotton silk', Fit: 'Regular' }, ['traditional']),
  P('ErgoFlex Office Chair', 249, 319, 'Home & Living', 'Furniture', 'ErgoFlex', 22, 'photo-1580480055273-228ff5388ef8', false, { isFeatured: true }, 4.6, 351, 'chair', { Material: 'Mesh', Warranty: '3 years' }, ['chair']),
  P('Arc Table Lamp', 58, null, 'Home & Living', 'Lighting', 'GlowRoom', 48, 'photo-1507473885765-e6ed057f782c', false, {}, 4.3, 142, 'lamp', { Light: 'LED', Modes: '3' }, ['lamp']),
  P('Barista Coffee Maker', 139, 169, 'Home & Living', 'Kitchen', 'BrewNest', 17, 'photo-1517668808822-9ebb02f2a0e6', false, { isBestSeller: true }, 4.4, 222, 'coffee maker', { Capacity: '1.5 L', Timer: '24 hour' }, ['coffee']),
  P('Oak Modular Bookshelf', 199, null, 'Home & Living', 'Storage', 'Dwell', 14, 'photo-1594620302200-9a762244a156', false, {}, 4.2, 96, 'bookshelf', { Shelves: '5', Finish: 'Oak' }, ['bookshelf']),
  P('Ceramic Dinnerware Set', 84, null, 'Home & Living', 'Kitchen', 'Tablely', 40, 'photo-1523413651479-597eb2da0ad6', false, {}, 4.1, 119, 'dinnerware', { Pieces: '16', Dishwasher: 'Safe' }, ['kitchen']),
  P('Woven Cotton Rug', 129, 159, 'Home & Living', 'Home Decor', 'Casa', 19, 'photo-1513519245088-0e12902e5a38', false, {}, 4.5, 164, 'rug', { Size: '5 x 7 ft', Material: 'Cotton' }, ['decor']),
  P('Airtight Storage Containers', 39, null, 'Home & Living', 'Storage', 'NeatStack', 76, 'photo-1586201375761-83865001e31c', false, {}, 4.4, 188, 'containers', { Count: '10', Material: 'BPA-free plastic' }, ['storage']),
  P('Memory Foam Pillow', 49, null, 'Home & Living', 'Home Decor', 'SleepWell', 64, 'photo-1584100936595-c0654b55a2e2', false, {}, 4.3, 205, 'pillow', { Fill: 'Memory foam', Cover: 'Washable' }, ['bedding']),
  P('Hydrating Face Wash', 18, null, 'Beauty', 'Skincare', 'ClearLeaf', 85, 'photo-1556228720-195a672e8a03', false, { isFeatured: true }, 4.5, 284, 'face wash', { SkinType: 'All', Volume: '150 ml' }, ['skincare']),
  P('Daily Moisturizer SPF 30', 26, 32, 'Beauty', 'Skincare', 'ClearLeaf', 71, 'photo-1620916566398-39f1143ab7be', false, {}, 4.6, 312, 'moisturizer', { SPF: '30', Volume: '60 ml' }, ['spf']),
  P('Velvet Matte Lipstick', 16, null, 'Beauty', 'Makeup', 'Muse', 54, 'photo-1586495777744-4413f21062fa', false, {}, 4.2, 198, 'lipstick', { Finish: 'Matte', Shade: 'Rosewood' }, ['makeup']),
  P('Ionic Hair Dryer', 74, 95, 'Beauty', 'Hair Care', 'AirSilk', 26, 'photo-1522338242992-e1a54906a8da', false, { isBestSeller: true }, 4.4, 177, 'hair dryer', { Power: '1800W', Settings: '3 heat' }, ['hair']),
  P('Herbal Shampoo', 14, null, 'Beauty', 'Hair Care', 'Botanica', 103, 'photo-1571781926291-c477ebfd024b', false, {}, 4.1, 144, 'shampoo', { Volume: '300 ml', Formula: 'Sulfate-free' }, ['personal care']),
  P('Aloe Body Lotion', 12, null, 'Beauty', 'Personal Care', 'Botanica', 92, 'photo-1608248597279-f99d160bfcbc', false, {}, 4.0, 117, 'body lotion', { Volume: '250 ml', Scent: 'Aloe' }, ['lotion']),
  P('Stride Running Shoes', 99, 125, 'Sports', 'Sportswear', 'Stride', 58, 'photo-1460353581641-37baddab0fa2', false, { isFeatured: true }, 4.5, 354, 'sports shoes', { Sole: 'Rubber', Use: 'Road running' }, ['fitness']),
  P('Grip Yoga Mat', 35, null, 'Sports', 'Fitness Equipment', 'FlexiFit', 83, 'photo-1592432678016-e910b452f9a2', false, {}, 4.6, 299, 'yoga mat', { Thickness: '6 mm', Material: 'TPE' }, ['yoga']),
  P('Match Football', 29, null, 'Sports', 'Outdoor Gear', 'GoalPro', 69, 'photo-1551958219-acbc608c6377', false, { isBestSeller: true }, 4.3, 231, 'football', { Size: '5', Material: 'PU' }, ['football']),
  P('Adjustable Dumbbell Pair', 149, 189, 'Sports', 'Fitness Equipment', 'FlexiFit', 11, 'photo-1583454110551-21f2fa2afe61', false, {}, 4.7, 186, 'dumbbells', { Range: '5-25 kg', Count: 'Pair' }, ['strength']),
  P('Insulated Water Bottle', 22, null, 'Sports', 'Outdoor Gear', 'HydroPeak', 99, 'photo-1602143407151-7111542de6e8', false, {}, 4.4, 275, 'bottle', { Capacity: '750 ml', Insulation: '24 hours' }, ['outdoor']),
  P('Trail Backpack', 64, null, 'Sports', 'Outdoor Gear', 'Trailmark', 33, 'photo-1553062407-98eeb64c6a62', false, {}, 4.2, 132, 'backpack', { Capacity: '25 L', RainCover: 'Included' }, ['backpack']),
  P('Modern TypeScript Handbook', 42, null, 'Books', 'Books', 'CodePress', 44, 'photo-1544716278-ca5e3f4abd8c', false, { isFeatured: true }, 4.7, 96, 'book', { Pages: '420', Format: 'Paperback' }, ['programming']),
  P('The Midnight Orchard', 18, null, 'Books', 'Books', 'BlueRiver', 57, 'photo-1512820790803-83ca734da794', false, {}, 4.4, 151, 'novel', { Pages: '304', Format: 'Paperback' }, ['novel']),
  P('Campus Notebook Set', 11, null, 'Books', 'School Supplies', 'Paperly', 130, 'photo-1531346680769-a1d79b57de5c', false, {}, 4.1, 88, 'notebook', { Count: '5', Pages: '120 each' }, ['notebook']),
  P('Desk Organizer Kit', 19, null, 'Books', 'Office Supplies', 'Paperly', 75, 'photo-1516321318423-f06f85e504b3', false, {}, 4.0, 64, 'stationery', { Pieces: '40', Material: 'Metal and paper' }, ['office']),
  P('Watercolor Art Pad', 16, null, 'Books', 'School Supplies', 'Artline', 61, 'photo-1513364776144-60967b0f800f', false, {}, 4.3, 73, 'art supplies', { Sheets: '30', Paper: '300 GSM' }, ['art']),
  P('Organic Breakfast Oats', 8, null, 'Grocery', 'Food', 'FarmBowl', 140, 'photo-1517673132405-a56a62b18caf', false, {}, 4.5, 206, 'oats', { Weight: '1 kg', Organic: 'Yes' }, ['food']),
  P('Cold Brew Coffee Pack', 13, null, 'Grocery', 'Beverages', 'RoastLab', 88, 'photo-1442512595331-e89e73853f31', false, {}, 4.4, 167, 'beverage', { Count: '8 packs', Roast: 'Medium' }, ['coffee']),
  P('Natural Dish Soap', 6, null, 'Grocery', 'Household Essentials', 'PureHome', 125, 'photo-1563453392212-326f5e854473', false, {}, 4.2, 111, 'dish soap', { Volume: '500 ml', Formula: 'Plant-based' }, ['household']),
  P('Mixed Nuts Jar', 15, null, 'Grocery', 'Food', 'NutriJar', 93, 'photo-1599599810769-bcde5a160d32', false, {}, 4.3, 134, 'nuts', { Weight: '500 g', Mix: 'Almonds, cashews, raisins' }, ['snacks']),
  P('Sparkling Lemon Water', 9, null, 'Grocery', 'Beverages', 'FizzCo', 118, 'photo-1544145945-f90425340c7e', false, {}, 4.0, 82, 'beverage', { Count: '6 cans', Sugar: '0 g' }, ['drink']),
  P('STEM Building Blocks', 44, 55, 'Toys & More', 'Toys', 'BrightPlay', 62, 'photo-1587654780291-39c9404d746b', false, { isFeatured: true }, 4.7, 245, 'toy', { Pieces: '320', Age: '6+' }, ['toys']),
  P('Mini Drone Explorer', 79, null, 'Toys & More', 'Gadgets', 'SkyKid', 21, 'photo-1473968512647-3e447244af8f', false, { isNew: true }, 4.1, 128, 'gadget', { Camera: '720p', FlightTime: '12 min' }, ['drone']),
  P('Cozy Pet Bed', 39, null, 'Toys & More', 'Pet Supplies', 'PawNest', 36, 'photo-1548199973-03cce0bbc87b', false, {}, 4.5, 172, 'pet bed', { Size: 'Medium', Cover: 'Washable' }, ['pet']),
  P('Digital Luggage Scale', 18, null, 'Toys & More', 'General Products', 'TravelMate', 68, 'photo-1488646953014-85cb44e25828', false, {}, 4.0, 72, 'scale', { Capacity: '50 kg', Battery: 'Included' }, ['travel']),
  P('Reusable Gift Wrap Kit', 21, null, 'Toys & More', 'General Products', 'WrapWell', 45, 'photo-1512909006721-3d6018887383', false, {}, 4.2, 65, 'gift wrap', { Count: '6', Material: 'Cotton' }, ['gift'])
];

const run = async () => {
  console.log('Seeding database...');
  await withTransaction(async (client) => {
    // Clear domain tables (dev reset) in FK-safe order.
    await client.query(`
      TRUNCATE notifications, tryon_results, returns, deliveries, payments,
               order_items, orders, cart_items, wishlist_items, addresses,
               product_images, products, category_subcategories, categories, users
      RESTART IDENTITY CASCADE
    `);

    // Users
    const hash = await bcrypt.hash('password123', config.bcryptRounds);
    const sellerIdByStore = {};
    let customerId; let deliveryId; let adminId; let demoSellerId;
    for (const u of USERS) {
      const { rows } = await client.query(
        'INSERT INTO users (name, email, password_hash, role, store_name) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [u.name, u.email, hash, u.role, u.storeName || null]
      );
      const id = rows[0].id;
      if (u.role === 'customer') customerId = id;
      if (u.role === 'delivery') deliveryId = id;
      if (u.role === 'admin') adminId = id;
      if (u.email === 'seller@demo.com') demoSellerId = id;
      if (u.storeName) sellerIdByStore[u.storeName] = id;
    }

    // Categories + subcategories
    const catIdByName = {};
    for (const c of CATEGORIES) {
      const { rows } = await client.query(
        'INSERT INTO categories (name, slug, description, image, icon) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [c.name, c.slug, c.description, c.image, c.icon]
      );
      catIdByName[c.name] = rows[0].id;
      for (const sub of c.subcategories) {
        await client.query('INSERT INTO category_subcategories (category_id, name) VALUES ($1,$2)', [rows[0].id, sub]);
      }
    }

    // Products (+images). Brand storefronts map to their seller.
    const productIdByName = {};
    for (const p of PRODUCTS) {
      // seller storefront for the product (from the mock sellerName mapping by category/brand)
      const store = storeForProduct(p);
      const sellerId = sellerIdByStore[store] || demoSellerId;
      const discount = p.originalPrice ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0;
      const { rows } = await client.query(
        `INSERT INTO products (seller_id, category_id, subcategory, name, price, original_price, discount,
           brand, rating, review_count, stock, specifications, tags, is_featured, is_new, is_best_seller,
           is_virtual_try_on_supported, product_type, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
        [sellerId, catIdByName[p.category], p.subcategory, p.name, p.price, p.originalPrice, discount,
         p.brand, p.rating, p.reviews, p.stock, JSON.stringify(p.specs), JSON.stringify(p.tags),
         !!p.isFeatured, !!p.isNew, !!p.isBestSeller, p.tryOn && p.category === 'Clothing', p.productType,
         descriptionFor(p)]
      );
      productIdByName[p.name] = rows[0].id;
      await client.query(
        'INSERT INTO product_images (product_id, url, sort_order, is_try_on_reference) VALUES ($1,$2,0,$3)',
        [rows[0].id, p.image, p.tryOn && p.category === 'Clothing']
      );
    }

    // Customer default address
    await client.query(
      `INSERT INTO addresses (user_id, label, name, phone, line1, city, region, postal_code, is_default)
       VALUES ($1,'Home','Maya Customer','+1 555 0188','42 Market Street','San Francisco','CA','94105',TRUE)`,
      [customerId]
    );

    // Two sample orders with items, payments, deliveries
    await seedOrder(client, {
      customerId, deliveryId, orderNumber: 'EC10234', status: 'Shipped', daysAgo: 5,
      items: [[productIdByName['Ultrabook Pro 14'], 1], [productIdByName['Everyday Cotton T-Shirt'], 2], [productIdByName['Barista Coffee Maker'], 1]]
    });
    await seedOrder(client, {
      customerId, deliveryId, orderNumber: 'EC10351', status: 'Delivered', daysAgo: 14,
      items: [[productIdByName['Modern TypeScript Handbook'], 1], [productIdByName['Cold Brew Coffee Pack'], 3]]
    });

    console.log(`Seeded: ${USERS.length} users, ${CATEGORIES.length} categories, ${PRODUCTS.length} products, 2 orders.`);
  });
};

// Map a seeded product to a seller storefront (matches the mock sellerName data).
const storeForProduct = (p) => {
  const byCategory = {
    Electronics: { NovaTech: 'TechSquare', Aster: 'TechSquare', Orbit: 'TechSquare', VividShot: 'TechSquare', ViewPoint: 'TechSquare', Pulse: 'AudioBay', SonicHome: 'AudioBay', Amply: 'GadgetLane', DeskHub: 'GadgetLane', Arcade: 'GadgetLane' },
    Clothing: { 'North & Loom': 'UrbanWear', BlueForge: 'UrbanWear', Arden: 'UrbanWear', Harbor: 'UrbanWear', Stride: 'UrbanWear', Elara: 'StyleMarket', Trailmark: 'StyleMarket', TinyTrail: 'StyleMarket', Mira: 'StyleMarket', Rang: 'StyleMarket' },
    'Home & Living': { ErgoFlex: 'HomeWorks', GlowRoom: 'HomeWorks', BrewNest: 'HomeWorks', Dwell: 'HomeWorks', Tablely: 'DailyHome', Casa: 'DailyHome', NeatStack: 'DailyHome', SleepWell: 'DailyHome' },
    Beauty: { ClearLeaf: 'GlowMart', Muse: 'GlowMart', AirSilk: 'GlowMart', Botanica: 'GlowMart' },
    Sports: { Stride: 'ActiveZone', FlexiFit: 'ActiveZone', GoalPro: 'ActiveZone', HydroPeak: 'ActiveZone', Trailmark: 'ActiveZone' },
    Books: { CodePress: 'BookCorner', BlueRiver: 'BookCorner', Paperly: 'BookCorner', Artline: 'BookCorner' },
    Grocery: { FarmBowl: 'FreshBasket', RoastLab: 'FreshBasket', PureHome: 'FreshBasket', NutriJar: 'FreshBasket', FizzCo: 'FreshBasket' },
    'Toys & More': { BrightPlay: 'PlayPlus', SkyKid: 'PlayPlus', PawNest: 'PlayPlus', TravelMate: 'PlayPlus', WrapWell: 'PlayPlus' }
  };
  return (byCategory[p.category] || {})[p.brand] || 'UrbanWear';
};

const descriptionFor = (p) => `${p.name} by ${p.brand}.`;

const seedOrder = async (client, { customerId, deliveryId, orderNumber, status, daysAgo, items }) => {
  // Look up current prices to compute totals and snapshot order items.
  let computed = 0;
  const detailed = [];
  for (const [pid, qty] of items) {
    const { rows } = await client.query(
      `SELECT p.name, p.price, (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order LIMIT 1) AS image FROM products p WHERE p.id = $1`,
      [pid]
    );
    computed += Number(rows[0].price) * qty;
    detailed.push({ pid, qty, name: rows[0].name, price: rows[0].price, image: rows[0].image });
  }
  const deliveryFee = computed > 100 ? 0 : 8;
  const discount = computed > 500 ? computed * 0.08 : 0;
  const total = computed + deliveryFee - discount;

  const { rows: orderRows } = await client.query(
    `INSERT INTO orders (order_number, customer_id, status, subtotal, delivery_fee, discount, total,
       ship_name, ship_phone, ship_line1, ship_city, ship_region, ship_postal_code, placed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'Maya Customer','+1 555 0188','42 Market Street','San Francisco','CA','94105', now() - make_interval(days => $8))
     RETURNING id`,
    [orderNumber, customerId, status, computed, deliveryFee, discount, total, daysAgo]
  );
  const orderId = orderRows[0].id;

  for (const d of detailed) {
    await client.query(
      'INSERT INTO order_items (order_id, product_id, quantity, unit_price, product_name, product_image) VALUES ($1,$2,$3,$4,$5,$6)',
      [orderId, d.pid, d.qty, d.price, d.name, d.image]
    );
  }
  await client.query(
    `INSERT INTO payments (order_id, provider, provider_ref, amount, currency, type, status) VALUES ($1,'stripe_test',$2,$3,'USD','charge','Paid')`,
    [orderId, `mock_pi_seed_${orderNumber}`, total]
  );
  await client.query(
    `INSERT INTO deliveries (order_id, agent_id, status, assigned_at, delivered_at)
     VALUES ($1,$2,$3::varchar, now() - make_interval(days => $4), CASE WHEN $3::varchar = 'Delivered' THEN now() - make_interval(days => $5) ELSE NULL END)`,
    [orderId, deliveryId, status === 'Delivered' ? 'Delivered' : status, daysAgo, Math.max(daysAgo - 1, 0)]
  );
};

run()
  .catch((err) => { console.error('Seed failed:', err); process.exitCode = 1; })
  .finally(() => pool.end());
