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
  { name: 'Electronics', slug: 'electronics', subcategories: ['Smartphones', 'Laptops', 'Headphones', 'Smart Watches', 'Cameras', 'Home Audio', 'Accessories'], description: 'Devices, gadgets, and everyday tech essentials.', icon: 'smartphone', image: img('photo-1519389950473-47ba0277781c') },
  { name: 'Clothing', slug: 'clothing', subcategories: ['T-Shirts', 'Shirts', 'Jeans', 'Dresses', 'Jackets', 'Footwear', 'Activewear', 'Kids Clothing', 'Hoodies'], description: 'Everyday fashion with try-on support for selected items.', icon: 'shirt', image: img('photo-1489987707025-afc232f7ea0f') },
  { name: 'Home & Living', slug: 'home', subcategories: ['Furniture', 'Kitchenware', 'Home Decor', 'Lighting', 'Storage', 'Bedding'], description: 'Furniture, kitchenware, decor, lighting, and storage.', icon: 'home', image: img('photo-1513694203232-719a280e022f') },
  { name: 'Beauty', slug: 'beauty', subcategories: ['Skincare', 'Makeup', 'Hair Care', 'Personal Care', 'Fragrance'], description: 'Personal care products for daily routines.', icon: 'sparkles', image: img('photo-1596462502278-27bfdc403348') },
  { name: 'Sports', slug: 'sports', subcategories: ['Sportswear', 'Fitness Equipment', 'Outdoor Gear', 'Team Sports', 'Footwear'], description: 'Gear for workouts, sports, and active weekends.', icon: 'dumbbell', image: img('photo-1517836357463-d25dfeac3438') },
  { name: 'Books', slug: 'books', subcategories: ['Fiction', 'Non-Fiction', 'Programming', 'Science & Tech', 'School Supplies', 'Stationery'], description: 'Reading, learning, and stationery for school or work.', icon: 'book-open', image: img('photo-1495446815901-a7297e633e8d') },
  { name: 'Grocery', slug: 'grocery', subcategories: ['Food & Snacks', 'Beverages', 'Household Essentials', 'Pantry Staples', 'Organic'], description: 'Pantry staples, drinks, and home essentials.', icon: 'shopping-basket', image: img('photo-1542838132-92c53300491e') },
  { name: 'Toys & More', slug: 'toys', subcategories: ['Toys & Games', 'Gadgets', 'Pet Supplies', 'Travel Accessories', 'General Products'], description: 'Gifts, play, gadgets, pet items, and useful extras.', icon: 'puzzle', image: img('photo-1566576912321-d58ddd7a6088') }
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

// [name, price, originalPrice, category, subcategory, brand, stock, imageId, tryOn, flags, rating, reviews, productType, specs, tags, extraImages]
const P = (name, price, originalPrice, category, subcategory, brand, stock, imageId, tryOn, flags, rating, reviews, productType, specs, tags, extraImages = []) =>
  ({ name, price, originalPrice, category, subcategory, brand, stock, image: img(imageId), extraImages: extraImages.map(img), tryOn: !!tryOn, ...flags, rating, reviews, productType, specs: specs || {}, tags: tags || [] });

const PRODUCTS = [
  // ===================== ELECTRONICS (18 products) =====================
  P('Nova X5 Smartphone', 699, 799, 'Electronics', 'Smartphones', 'NovaTech', 42, 'photo-1511707171634-5f897ff02aa9', false, { isFeatured: true, isBestSeller: true }, 4.7, 1240, 'Smartphone', { Storage: '256 GB', Display: '6.5 inch OLED', Battery: '4500 mAh', Warranty: '1 year' }, ['5G', 'OLED', 'NovaTech', 'Smartphone']),
  P('Galaxy Ultra 5G', 899, 999, 'Electronics', 'Smartphones', 'NovaTech', 28, 'photo-1598327105666-5b89351aff97', false, { isNew: true }, 4.8, 930, 'Smartphone', { Storage: '512 GB', RAM: '12 GB', Camera: '108 MP' }, ['5G', 'Flagship', 'Android']),
  P('Budget Smartphone Lite', 249, 299, 'Electronics', 'Smartphones', 'Aster', 65, 'photo-1567581935884-3349723552ca', false, {}, 4.3, 410, 'Smartphone', { Storage: '128 GB', Battery: '5000 mAh' }, ['Budget', 'Dual SIM']),
  P('PixelCraft Pro Phone', 749, 829, 'Electronics', 'Smartphones', 'NovaTech', 31, 'photo-1592899677977-9c10ca588bbd', false, {}, 4.6, 520, 'Smartphone', { Storage: '256 GB', Camera: '50 MP AI', RAM: '8 GB' }, ['AI Camera', 'Fast Charging']),
  P('Ultrabook Pro 14', 1199, 1399, 'Electronics', 'Laptops', 'Aster', 18, 'photo-1496181133206-80ce9b88a853', false, { isFeatured: true }, 4.8, 860, 'Laptop', { Processor: 'Intel Core i7', RAM: '16 GB', Storage: '1 TB SSD', Display: '14 inch 2.8K' }, ['laptop', 'student', 'pro']),
  P('Student Laptop Go', 499, 599, 'Electronics', 'Laptops', 'Aster', 45, 'photo-1525547719571-a2d4ac8945e2', false, {}, 4.4, 380, 'Laptop', { Processor: 'Intel Core i3', RAM: '8 GB', Storage: '256 GB SSD' }, ['Education', 'Lightweight']),
  P('Titan Gaming Laptop', 1699, 1899, 'Electronics', 'Laptops', 'Arcade', 14, 'photo-1603302576837-37561b2e2302', false, { isBestSeller: true }, 4.9, 712, 'Laptop', { GPU: 'RTX 4070', RAM: '32 GB', RefreshRate: '240Hz' }, ['Gaming', 'RGB', 'High Performance']),
  P('KadaBook Air 14', 799, 899, 'Electronics', 'Laptops', 'Aster', 25, 'photo-1541807084-5c52b6b3adef', false, { isNew: true }, 4.7, 195, 'Laptop', { RAM: '16 GB', Storage: '512 GB SSD', Processor: 'Intel Core i5', Display: '14 inch' }, ['Slim', 'Aluminum', 'Work']),
  P('Pulse Wireless Headphones', 179, 229, 'Electronics', 'Headphones', 'Pulse', 66, 'photo-1505740420928-5e560c06d30e', false, { isBestSeller: true }, 4.5, 530, 'Headphones', { Battery: '35 hours', Connectivity: 'Bluetooth 5.3', ANC: 'Active Noise Cancelling' }, ['audio', 'wireless', 'ANC']),
  P('SoundAir Pro Earbuds', 129, 159, 'Electronics', 'Headphones', 'Pulse', 80, 'photo-1590658268037-6bf12165a8df', false, { isNew: true }, 4.6, 320, 'Earbuds', { Battery: '28 hours with case', Waterproof: 'IPX5' }, ['Wireless', 'Earbuds', 'Mic']),
  P('Sonic Studio Over-Ear', 299, 349, 'Electronics', 'Headphones', 'AudioBay', 22, 'photo-1546435770-a3e426bf472b', false, {}, 4.7, 240, 'Headphones', { Driver: '50mm', Frequency: '10Hz-40kHz' }, ['Studio', 'Audiophile']),
  P('Orbit Smart Watch', 249, 299, 'Electronics', 'Smart Watches', 'Orbit', 37, 'photo-1523275335684-37898b6baf30', false, { isNew: true }, 4.4, 421, 'Smart Watch', { Battery: '8 days', WaterResistance: '5 ATM', HeartRate: 'Continuous' }, ['watch', 'fitness', 'smart']),
  P('FitTrack Active Watch', 149, 189, 'Electronics', 'Smart Watches', 'Orbit', 50, 'photo-1579586337278-3befd40fd17a', false, {}, 4.3, 280, 'Smart Watch', { GPS: 'Built-in', SpO2: 'Yes', Battery: '12 days' }, ['Fitness', 'GPS', 'Tracker']),
  P('VividShot Mirrorless Camera', 899, null, 'Electronics', 'Cameras', 'VividShot', 12, 'photo-1516035069371-29a1b244cc32', false, {}, 4.6, 288, 'Mirrorless Camera', { Sensor: 'APS-C 24.2 MP', Video: '4K 60fps', Mount: 'E-mount' }, ['camera', 'creator', '4K']),
  P('ActionCam 4K Rugged', 199, 249, 'Electronics', 'Cameras', 'VividShot', 34, 'photo-1526170375885-4d8ecf77b99f', false, {}, 4.5, 310, 'Action Camera', { Waterproof: '10m without case', Stabilization: 'HyperSmooth' }, ['Action', 'Sports', 'Waterproof']),
  P('MegaBass Bluetooth Speaker', 129, null, 'Electronics', 'Home Audio', 'SonicHome', 34, 'photo-1545454675-3531b543be5d', false, {}, 4.1, 142, 'Speaker', { Power: '30W', Battery: '15 hours', Connectivity: 'Bluetooth 5.2' }, ['speaker', 'audio', 'portable']),
  P('DeskHub USB-C Dock', 89, 119, 'Electronics', 'Accessories', 'DeskHub', 51, 'photo-1625842268584-8f3296236761', false, {}, 4.3, 231, 'Dock', { Ports: '9 in 1', Output: 'Dual 4K HDMI', PowerDelivery: '100W' }, ['workstation', 'usb-c']),
  P('ViewPoint 27 4K Monitor', 329, 389, 'Electronics', 'Accessories', 'ViewPoint', 23, 'photo-1527443224154-c4a3942d3acf', false, { isFeatured: true }, 4.6, 317, 'Monitor', { Size: '27 inch', Resolution: '3840x2160 UHD', RefreshRate: '75Hz' }, ['monitor', '4k', 'office']),

  // ===================== CLOTHING (22 products) =====================
  P('Classic Cotton T-Shirt', 25, 35, 'Clothing', 'T-Shirts', 'UrbanWear', 90, 'photo-1521572163474-6864f9cf17ab', true, { isFeatured: true }, 4.5, 820, 'T-Shirt', { Material: '100% Cotton', Fit: 'Regular', Collar: 'Crewneck' }, ['cotton', 'casual', 'tshirt', 'classic']),
  P('Everyday Cotton T-Shirt', 24, 32, 'Clothing', 'T-Shirts', 'North & Loom', 120, 'photo-1581655353564-df123a1eb820', true, {}, 4.4, 715, 'T-Shirt', { Material: 'Organic Cotton', Fit: 'Comfort' }, ['cotton', 'casual']),
  P('Graphic Oversized Tee', 29, 39, 'Clothing', 'T-Shirts', 'UrbanFit', 75, 'photo-1503342217505-b0a15ec3261c', true, { isNew: true }, 4.6, 340, 'T-Shirt', { Material: 'Cotton', Style: 'Streetwear Oversized' }, ['streetwear', 'oversized']),
  P('Oxford Formal Shirt', 45, 59, 'Clothing', 'Shirts', 'Arden', 53, 'photo-1596755094514-f87e34085b2c', true, { isBestSeller: true }, 4.5, 306, 'Shirt', { Material: 'Cotton blend', Fit: 'Slim Fit', Sleeve: 'Full Sleeve' }, ['formal', 'office', 'shirt']),
  P('Linen Casual Shirt', 49, 65, 'Clothing', 'Shirts', 'UrbanWear', 45, 'photo-1602810318383-e386cc2a3ccf', true, {}, 4.6, 210, 'Shirt', { Material: '100% Linen', Breathable: 'Yes' }, ['summer', 'casual', 'linen']),
  P('Slim Fit Denim Jeans', 59, 79, 'Clothing', 'Jeans', 'BlueForge', 74, 'photo-1542272604-787c3835535d', true, {}, 4.3, 489, 'Jeans', { Material: 'Stretch Denim', Fit: 'Slim', Rise: 'Mid' }, ['denim', 'jeans', 'casual']),
  P('Relaxed Comfort Jeans', 65, 85, 'Clothing', 'Jeans', 'BlueForge', 60, 'photo-1541099649105-f69ad21f3246', true, {}, 4.4, 310, 'Jeans', { Material: '100% Cotton Denim', Fit: 'Relaxed' }, ['denim', 'comfort']),
  P('Weekend Casual Hoodie', 54, 70, 'Clothing', 'Hoodies', 'Harbor', 39, 'photo-1556821840-3a63f95609a7', true, { isBestSeller: true }, 4.6, 512, 'Hoodie', { Material: 'Cotton Fleece', Pocket: 'Kangaroo', Hood: 'Adjustable drawstring' }, ['hoodie', 'warm', 'casual']),
  P('UrbanFit Oversized Hoodie', 69, 89, 'Clothing', 'Hoodies', 'UrbanFit', 40, 'photo-1509967419530-da38b4704bc6', true, { isNew: true }, 4.7, 280, 'Hoodie', { Material: 'Heavyweight Cotton', Style: 'Drop Shoulder' }, ['streetwear', 'oversized', 'hoodie']),
  P('Rainproof Field Jacket', 119, 149, 'Clothing', 'Jackets', 'Trailmark', 20, 'photo-1543076447-215ad9ba6923', true, {}, 4.4, 211, 'Jacket', { Shell: 'Water-resistant nylon', Pockets: '4 exterior, 1 interior' }, ['jacket', 'outdoor', 'rain']),
  P('Denim Trucker Jacket', 89, 110, 'Clothing', 'Jackets', 'UrbanWear', 35, 'photo-1576995853123-5a10305d93c0', true, {}, 4.5, 185, 'Jacket', { Material: 'Denim', Closure: 'Button Front' }, ['denim', 'vintage', 'jacket']),
  P('Floral Summer Midi Dress', 76, 95, 'Clothing', 'Dresses', 'Elara', 28, 'photo-1515372039744-b8f02a3ae446', true, { isFeatured: true }, 4.7, 274, 'Dress', { Material: 'Viscose blend', Length: 'Midi', Pattern: 'Floral' }, ['dress', 'summer', 'floral']),
  P('Elegant Evening Dress', 110, 140, 'Clothing', 'Dresses', 'Elara', 22, 'photo-1566174053879-31528523f8ae', true, {}, 4.8, 160, 'Dress', { Material: 'Satin Silk', Length: 'Maxi', Neckline: 'V-neck' }, ['evening', 'party', 'dress']),
  P('Athletic Running Shoes', 112, 140, 'Clothing', 'Footwear', 'Stride', 46, 'photo-1542291026-7eec264c27ff', false, {}, 4.6, 697, 'Shoes', { Cushioning: 'Responsive Foam', Sole: 'Rubber Grip' }, ['shoes', 'running', 'sport']),
  P('Classic White Sneakers', 79, 99, 'Clothing', 'Footwear', 'Stride', 68, 'photo-1525966222134-fcfa99b8ae77', false, { isBestSeller: true }, 4.5, 450, 'Shoes', { Material: 'Leather & Mesh', Style: 'Low Top' }, ['sneakers', 'casual', 'white']),
  P('Performance Running T-Shirt', 35, 45, 'Clothing', 'Activewear', 'ActiveZone', 85, 'photo-1506152983158-b4a74a01c721', true, {}, 4.5, 290, 'Activewear', { Technology: 'Dri-Fit', Material: 'Polyester Spandex' }, ['activewear', 'workout', 'running']),
  P('Flex Fit Track Pants', 42, 55, 'Clothing', 'Activewear', 'UrbanWear', 65, 'photo-1552902865-b72c031ac5ea', false, {}, 4.4, 215, 'Track Pants', { Waist: 'Elastic Drawstring', Pockets: 'Zippered' }, ['joggers', 'gym', 'comfort']),
  P('Kids Graphic Tee 3-Pack', 34, 45, 'Clothing', 'Kids Clothing', 'TinyTrail', 88, 'photo-1503919545889-aef636e10ad4', false, {}, 4.2, 168, 'Kids Clothing', { Pieces: '3', Material: '100% Cotton' }, ['kids', 'pack', 'cotton']),
  P('Kids Fleece Hoodie', 38, 48, 'Clothing', 'Kids Clothing', 'TinyTrail', 55, 'photo-1519238263530-99bdd11df2ea', false, {}, 4.5, 140, 'Kids Hoodie', { Material: 'Soft Fleece', Washable: 'Machine safe' }, ['kids', 'hoodie', 'warm']),
  P('Traditional Cotton Kurta', 68, 85, 'Clothing', 'Shirts', 'Rang', 31, 'photo-1597983073493-88cd35cf93b0', true, { isNew: true }, 4.5, 194, 'Kurta', { Material: 'Cotton Silk', Pattern: 'Embroidered Collar' }, ['traditional', 'festive', 'kurta']),
  P('Striped Polo T-Shirt', 39, 49, 'Clothing', 'T-Shirts', 'North & Loom', 50, 'photo-1625910513413-7a918a59441a', true, {}, 4.3, 175, 'Polo Shirt', { Material: 'Cotton Pique', Collar: 'Ribbed Polo' }, ['polo', 'casual', 'smart']),
  P('KadaWear Everyday Tee', 22, 30, 'Clothing', 'T-Shirts', 'KadaWear', 110, 'photo-1583743814966-8936f5b7be1a', true, {}, 4.6, 320, 'T-Shirt', { Material: '100% Combed Cotton', PreShrunk: 'Yes' }, ['everyday', 'basics', 'kadawear']),

  // ===================== HOME & LIVING (14 products) =====================
  P('ErgoFlex Office Chair', 249, 319, 'Home & Living', 'Furniture', 'ErgoFlex', 22, 'photo-1580480055273-228ff5388ef8', false, { isFeatured: true }, 4.6, 351, 'Chair', { Material: 'Breathable Mesh', LumbarSupport: 'Adjustable', Warranty: '3 years' }, ['chair', 'ergonomic', 'office']),
  P('Minimal Wooden Study Table', 189, 239, 'Home & Living', 'Furniture', 'HomeWorks', 15, 'photo-1518455027359-f3f8164ba6bd', false, {}, 4.7, 180, 'Study Table', { Material: 'Solid Pine Wood', Dimensions: '120 x 60 x 75 cm' }, ['table', 'desk', 'wood']),
  P('Oak Modular Bookshelf', 199, null, 'Home & Living', 'Storage', 'Dwell', 14, 'photo-1594620302200-9a762244a156', false, {}, 4.2, 96, 'Bookshelf', { Shelves: '5', Finish: 'Oak Veneer' }, ['bookshelf', 'storage']),
  P('Arc Table Lamp', 58, 75, 'Home & Living', 'Lighting', 'GlowRoom', 48, 'photo-1507473885765-e6ed057f782c', false, {}, 4.3, 142, 'Table Lamp', { LightSource: 'Warm LED', Dimmable: '3 Levels' }, ['lamp', 'lighting', 'desk']),
  P('Modern Bedside Lamp', 45, 59, 'Home & Living', 'Lighting', 'GlowRoom', 62, 'photo-1513506003901-1e6a229e2d15', false, {}, 4.4, 110, 'Bedside Lamp', { Base: 'Ceramic', Shade: 'Linen Fabric' }, ['lighting', 'bedroom']),
  P('Barista Espresso Coffee Maker', 139, 169, 'Home & Living', 'Kitchenware', 'BrewNest', 17, 'photo-1517668808822-9ebb02f2a0e6', false, { isBestSeller: true }, 4.4, 222, 'Coffee Maker', { Pressure: '15 Bar', TankCapacity: '1.5 Litres', Frother: 'Steam wand' }, ['coffee', 'kitchen', 'espresso']),
  P('Ceramic 16-Piece Dinner Set', 84, 109, 'Home & Living', 'Kitchenware', 'Tablely', 40, 'photo-1523413651479-597eb2da0ad6', false, {}, 4.1, 119, 'Dinner Set', { Pieces: '16 (4 plates, 4 bowls, 4 mugs, 4 side plates)', MicrowaveSafe: 'Yes' }, ['kitchen', 'dinnerware']),
  P('Airtight Food Storage Containers', 39, null, 'Home & Living', 'Storage', 'NeatStack', 76, 'photo-1586201375761-83865001e31c', false, {}, 4.4, 188, 'Storage', { Count: '10 Containers', Material: 'BPA-Free Acrylic' }, ['storage', 'kitchen', 'organization']),
  P('Woven Geometric Cotton Rug', 129, 159, 'Home & Living', 'Home Decor', 'Casa', 19, 'photo-1513519245088-0e12902e5a38', false, {}, 4.5, 164, 'Rug', { Size: '5 x 7 ft', Material: '100% Hand-woven Cotton' }, ['decor', 'rug', 'boho']),
  P('Velvet Cushion Set of 4', 35, 45, 'Home & Living', 'Home Decor', 'Casa', 55, 'photo-1584100936595-c0654b55a2e2', false, {}, 4.3, 130, 'Cushion Set', { Count: '4 Pillows', Fabric: 'Plush Velvet' }, ['cushions', 'sofa', 'decor']),
  P('Memory Foam Pillow', 49, null, 'Home & Living', 'Bedding', 'SleepWell', 64, 'photo-1629949009765-40fc74c95018', false, {}, 4.3, 205, 'Pillow', { Fill: 'Contour Memory Foam', Cover: 'Cooling Bamboo' }, ['bedding', 'sleep', 'pillow']),
  P('Pure Cotton Bedsheet Set', 59, 79, 'Home & Living', 'Bedding', 'DailyHome', 42, 'photo-1522771739844-6a9f6d5f14af', false, { isNew: true }, 4.6, 175, 'Bedsheet Set', { ThreadCount: '400 TC', Size: 'Queen', Pieces: '1 Sheet + 2 Pillowcases' }, ['bedsheet', 'cotton', 'luxury']),
  P('Stainless Steel Chef Pan', 65, 85, 'Home & Living', 'Kitchenware', 'HomeWorks', 33, 'photo-1585515320310-259814833e62', false, {}, 4.5, 145, 'Cookware', { Material: 'Tri-Ply Stainless Steel', Diameter: '28 cm' }, ['cookware', 'pan', 'kitchen']),
  P('Wall Mounted Coat Rack', 29, 39, 'Home & Living', 'Storage', 'DailyHome', 50, 'photo-1534349762230-e0cadf78f5da', false, {}, 4.2, 85, 'Organizer', { Hooks: '6 Triple Hooks', Material: 'Solid Bamboo' }, ['entryway', 'rack', 'hooks']),

  // ===================== BEAUTY (12 products) =====================
  P('Hydrating Gentle Face Wash', 18, 24, 'Beauty', 'Skincare', 'ClearLeaf', 85, 'photo-1556228720-195a672e8a03', false, { isFeatured: true }, 4.5, 284, 'Face Wash', { SkinType: 'All types', Volume: '150 ml', Formula: 'Hyaluronic Acid' }, ['skincare', 'face wash', 'cleanse']),
  P('Daily Moisturizer SPF 30', 26, 32, 'Beauty', 'Skincare', 'ClearLeaf', 71, 'photo-1620916566398-39f1143ab7be', false, {}, 4.6, 312, 'Moisturizer', { SPF: '30 PA+++', Volume: '60 ml' }, ['spf', 'moisturizer', 'daily']),
  P('Vitamin C Brightening Serum', 34, 45, 'Beauty', 'Skincare', 'ClearLeaf', 58, 'photo-1608248597279-f99d160bfcbc', false, { isBestSeller: true }, 4.7, 390, 'Serum', { Concentration: '15% Vitamin C', Volume: '30 ml' }, ['serum', 'glow', 'skincare']),
  P('Mineral Sunscreen SPF 50', 28, 36, 'Beauty', 'Skincare', 'GlowMart', 65, 'photo-1598440947619-2c35fc9aa908', false, {}, 4.4, 210, 'Sunscreen', { SPF: '50+ PA++++', WaterResistant: '80 min' }, ['sunscreen', 'uv', 'summer']),
  P('Velvet Matte Lipstick', 16, 22, 'Beauty', 'Makeup', 'Muse', 54, 'photo-1586495777744-4413f21062fa', false, {}, 4.2, 198, 'Lipstick', { Finish: 'Matte', Shade: 'Berry Crimson', WearTime: '12 hours' }, ['makeup', 'lipstick', 'matte']),
  P('Longwear Liquid Foundation', 29, 39, 'Beauty', 'Makeup', 'Muse', 48, 'photo-1522337360788-8b13dee7a37e', false, {}, 4.5, 185, 'Foundation', { Coverage: 'Medium to Full', Finish: 'Natural Radiance' }, ['foundation', 'makeup', 'face']),
  P('Ionic Pro Hair Dryer', 74, 95, 'Beauty', 'Hair Care', 'AirSilk', 26, 'photo-1522338242992-e1a54906a8da', false, { isBestSeller: true }, 4.4, 177, 'Hair Dryer', { Power: '2000W', Technology: 'Tourmaline Ionic', HeatSettings: '3' }, ['hair', 'styling', 'dryer']),
  P('Herbal Nourishing Shampoo', 14, 18, 'Beauty', 'Hair Care', 'Botanica', 103, 'photo-1571781926291-c477ebfd024b', false, {}, 4.1, 144, 'Shampoo', { Volume: '350 ml', Formula: 'Sulfate-Free Tea Tree & Mint' }, ['hair care', 'shampoo', 'natural']),
  P('Argan Oil Hair Conditioner', 16, 20, 'Beauty', 'Hair Care', 'Botanica', 90, 'photo-1535585209827-a15fcdbc4c2d', false, {}, 4.3, 130, 'Conditioner', { Volume: '350 ml', MainIngredient: 'Moroccan Argan Oil' }, ['hair', 'conditioner', 'argan']),
  P('Soothing Aloe Body Lotion', 12, null, 'Beauty', 'Personal Care', 'Botanica', 92, 'photo-1556228722-d0b5ae7970d4', false, {}, 4.0, 117, 'Body Lotion', { Volume: '250 ml', Hydration: '24 Hour Moisture' }, ['body', 'lotion', 'aloe']),
  P('Shea Butter Lip Balm Duo', 9, 12, 'Beauty', 'Personal Care', 'GlowMart', 110, 'photo-1599305445671-ac291c95aaa9', false, {}, 4.4, 160, 'Lip Balm', { Count: '2 Sticks', Ingredients: 'Organic Shea Butter & Beeswax' }, ['lip care', 'balm', 'moisturize']),
  P('Midnight Rose Eau De Parfum', 65, 85, 'Beauty', 'Fragrance', 'Muse', 30, 'photo-1594035910387-fea47794261f', false, { isNew: true }, 4.7, 210, 'Perfume', { Volume: '100 ml', Notes: 'Damask Rose, Amber, Vanilla' }, ['perfume', 'fragrance', 'luxury']),

  // ===================== SPORTS (12 products) =====================
  P('Stride Road Running Shoes', 99, 125, 'Sports', 'Footwear', 'Stride', 58, 'photo-1460353581641-37baddab0fa2', false, { isFeatured: true }, 4.5, 354, 'Running Shoes', { Upper: 'Engineered Mesh', Drop: '8mm' }, ['fitness', 'shoes', 'running']),
  P('Trail Runner All-Terrain', 119, 149, 'Sports', 'Footwear', 'Stride', 36, 'photo-1551107696-a4b0c5a0d9a2', false, {}, 4.6, 210, 'Trail Shoes', { LugDepth: '5mm', Outsole: 'Vibram Grip' }, ['trail', 'hiking', 'outdoor']),
  P('Grip Non-Slip Yoga Mat', 35, 45, 'Sports', 'Fitness Equipment', 'FlexiFit', 83, 'photo-1592432678016-e910b452f9a2', false, {}, 4.6, 299, 'Yoga Mat', { Thickness: '6 mm', Material: 'Eco TPE', AlignmentLines: 'Yes' }, ['yoga', 'pilates', 'mat']),
  P('Adjustable Dumbbell Pair 25kg', 149, 189, 'Sports', 'Fitness Equipment', 'FlexiFit', 11, 'photo-1583454110551-21f2fa2afe61', false, { isBestSeller: true }, 4.7, 186, 'Dumbbells', { WeightRange: '2.5 - 25 kg each', Mechanism: 'Quick Turn Dial' }, ['gym', 'weights', 'strength']),
  P('Resistance Bands Set 5-Pack', 22, 30, 'Sports', 'Fitness Equipment', 'FlexiFit', 95, 'photo-1517838277536-f5f99be501cd', false, {}, 4.5, 230, 'Resistance Bands', { Levels: '5 Resistance Levels', Material: '100% Natural Latex' }, ['bands', 'workout', 'home gym']),
  P('Match Official Football', 29, 39, 'Sports', 'Team Sports', 'GoalPro', 69, 'photo-1551958219-acbc608c6377', false, { isBestSeller: true }, 4.3, 231, 'Football', { Size: '5', Material: 'Textured PU', Bladder: 'Butyl' }, ['football', 'soccer', 'match']),
  P('Street Grip Basketball', 28, 35, 'Sports', 'Team Sports', 'GoalPro', 50, 'photo-1519861531473-9200262188bf', false, {}, 4.4, 190, 'Basketball', { Size: '7 (29.5 inch)', Grip: 'Deep Channel Rubber' }, ['basketball', 'court', 'street']),
  P('Pro Gym Workout Gloves', 18, 25, 'Sports', 'Fitness Equipment', 'ActiveZone', 75, 'photo-1581009146145-b5ef050c2e1e', false, {}, 4.2, 140, 'Gym Gloves', { Padding: 'Silicone Palm', WristWrap: 'Adjustable Velcro' }, ['gloves', 'weightlifting', 'gym']),
  P('Insulated Thermal Water Bottle', 22, 30, 'Sports', 'Outdoor Gear', 'HydroPeak', 99, 'photo-1602143407151-7111542de6e8', false, {}, 4.4, 275, 'Water Bottle', { Capacity: '750 ml', Insulation: '24h Cold / 12h Hot', Material: '18/8 Stainless Steel' }, ['bottle', 'hydration', 'hiking']),
  P('All-Weather Trail Backpack', 64, 85, 'Sports', 'Outdoor Gear', 'Trailmark', 33, 'photo-1553062407-98eeb64c6a62', false, {}, 4.2, 132, 'Backpack', { Capacity: '30 L', RainCover: 'Integrated', HydrationPocket: 'Compatible' }, ['backpack', 'hiking', 'outdoor']),
  P('Quick-Dry Sports T-Shirt', 25, 32, 'Sports', 'Sportswear', 'ActiveZone', 70, 'photo-1517836357463-d25dfeac3438', false, {}, 4.5, 195, 'Sports T-Shirt', { Fabric: 'Ultra-light Polyamide', AntiOdor: 'Silver Ion Tech' }, ['sportswear', 'running', 'gym']),
  P('Training Compression Shorts', 26, 35, 'Sports', 'Sportswear', 'ActiveZone', 60, 'photo-1506152983158-b4a74a01c721', false, {}, 4.3, 160, 'Activewear', { Fit: 'Compression', PhonePocket: 'Yes' }, ['shorts', 'compression', 'training']),

  // ===================== BOOKS (12 products) =====================
  P('Modern TypeScript Handbook', 42, 52, 'Books', 'Programming', 'CodePress', 44, 'photo-1544716278-ca5e3f4abd8c', false, { isFeatured: true }, 4.7, 96, 'Programming Book', { Pages: '430', Edition: '2nd Edition', Level: 'Intermediate to Advanced' }, ['typescript', 'programming', 'javascript']),
  P('Designing Data-Intensive Systems', 49, 60, 'Books', 'Programming', 'CodePress', 38, 'photo-1532012164546-f432f2e3777f', false, { isBestSeller: true }, 4.9, 310, 'Programming Book', { Pages: '616', Topic: 'Distributed Systems & Databases' }, ['architecture', 'data', 'software']),
  P('Operating Systems Concepts', 55, 70, 'Books', 'Science & Tech', 'CodePress', 25, 'photo-1512820790803-83ca734da794', false, {}, 4.6, 140, 'Textbook', { Pages: '800', Format: 'Hardcover' }, ['cs', 'os', 'textbook']),
  P('Artificial Intelligence Essentials', 46, 58, 'Books', 'Science & Tech', 'CodePress', 32, 'photo-1526374965328-7f61d4dc18c5', false, { isNew: true }, 4.7, 125, 'Textbook', { Pages: '480', Focus: 'ML, Neural Nets, Deep Learning' }, ['ai', 'machine learning', 'tech']),
  P('The Midnight Orchard', 18, 24, 'Books', 'Fiction', 'BlueRiver', 57, 'photo-1495446815901-a7297e633e8d', false, {}, 4.4, 151, 'Novel', { Genre: 'Mystery & Magical Realism', Pages: '304' }, ['fiction', 'novel', 'bestseller']),
  P('Echoes of the Horizon', 16, 22, 'Books', 'Fiction', 'BlueRiver', 45, 'photo-1476275466078-4007374efbbe', false, {}, 4.3, 110, 'Novel', { Genre: 'Sci-Fi Space Adventure', Pages: '380' }, ['scifi', 'space', 'novel']),
  P('The Atomic Habit Blueprint', 21, 28, 'Books', 'Non-Fiction', 'BlueRiver', 80, 'photo-1544947950-fa07a98d237f', false, { isBestSeller: true }, 4.8, 560, 'Self Help', { Pages: '288', Category: 'Productivity & Habits' }, ['habits', 'self-help', 'mindset']),
  P('World History Illustrated', 34, 45, 'Books', 'Non-Fiction', 'BlueRiver', 30, 'photo-1463320726281-696a485928c7', false, {}, 4.5, 90, 'History Book', { Pages: '512', Illustrations: 'Full Color' }, ['history', 'education', 'nonfiction']),
  P('Campus Hardcover Notebook Set', 14, 19, 'Books', 'School Supplies', 'Paperly', 130, 'photo-1531346680769-a1d79b57de5c', false, {}, 4.1, 88, 'Notebook', { Count: '3 Books', Pages: '160 Ruled each', Paper: '100 GSM' }, ['notebook', 'stationery', 'study']),
  P('Desk Organizer Kit Deluxe', 22, 29, 'Books', 'Stationery', 'Paperly', 75, 'photo-1516321318423-f06f85e504b3', false, {}, 4.0, 64, 'Organizer', { Compartments: '6', Material: 'Steel Mesh' }, ['desk', 'office', 'organizer']),
  P('Professional Watercolor Art Pad', 18, 25, 'Books', 'Stationery', 'Artline', 61, 'photo-1513364776144-60967b0f800f', false, {}, 4.3, 73, 'Art Supplies', { Sheets: '30 Cold Press', Weight: '300 GSM Heavyweight' }, ['art', 'watercolor', 'painting']),
  P('Dual Brush Calligraphy Pen Set', 19, 26, 'Books', 'Stationery', 'Artline', 70, 'photo-1585776245991-cf89dd7fc73a', false, {}, 4.6, 115, 'Pens', { Count: '12 Colors', Tips: 'Flexible Brush + Fine Bullet' }, ['calligraphy', 'pens', 'sketching']),

  // ===================== GROCERY (12 products) =====================
  P('Organic Rolled Breakfast Oats', 9, 12, 'Grocery', 'Food & Snacks', 'FarmBowl', 140, 'photo-1517673132405-a56a62b18caf', false, { isFeatured: true }, 4.5, 206, 'Oats', { Weight: '1 kg', Certification: 'USDA Organic' }, ['oats', 'breakfast', 'healthy']),
  P('Himalayan Roasted Mixed Nuts', 16, 22, 'Grocery', 'Food & Snacks', 'NutriJar', 93, 'photo-1599599810769-bcde5a160d32', false, {}, 4.3, 134, 'Nuts', { Weight: '500 g', Ingredients: 'Almonds, Cashews, Walnuts, Pistachios' }, ['nuts', 'snack', 'protein']),
  P('Premium Arabica Coffee Beans', 18, 24, 'Grocery', 'Beverages', 'RoastLab', 100, 'photo-1559056199-641a0ac8b55e', false, { isBestSeller: true }, 4.7, 340, 'Coffee', { Weight: '500 g', Roast: 'Medium Dark', Origin: 'Ethiopia & Colombia' }, ['coffee', 'arabica', 'artisan']),
  P('Cold Brew Coffee Concentrate', 14, 18, 'Grocery', 'Beverages', 'RoastLab', 88, 'photo-1442512595331-e89e73853f31', false, {}, 4.4, 167, 'Coffee', { Volume: '950 ml', Servings: '12 glasses' }, ['cold brew', 'coffee', 'beverage']),
  P('Pure Darjeeling Green Tea', 11, 15, 'Grocery', 'Beverages', 'FreshBasket', 115, 'photo-1576092768241-dec231879fc3', false, {}, 4.6, 180, 'Tea', { Count: '50 Pyramid Bags', Type: 'First Flush Darjeeling' }, ['tea', 'green tea', 'organic']),
  P('Sparkling Lemon Water 6-Pack', 8, null, 'Grocery', 'Beverages', 'FizzCo', 118, 'photo-1544145945-f90425340c7e', false, {}, 4.0, 82, 'Drink', { Count: '6 x 330ml Cans', Calories: 'Zero', Sugar: '0g' }, ['sparkling', 'beverage', 'zero sugar']),
  P('Natural Plant-Based Dish Soap', 7, 10, 'Grocery', 'Household Essentials', 'PureHome', 125, 'photo-1563453392212-326f5e854473', false, {}, 4.2, 111, 'Dish Soap', { Volume: '500 ml', Scent: 'Citrus & Lavender' }, ['cleaning', 'eco-friendly', 'soap']),
  P('Eco-Friendly Laundry Pods', 15, 20, 'Grocery', 'Household Essentials', 'PureHome', 85, 'photo-1584820927498-cfe5211fd8bf', false, {}, 4.5, 140, 'Detergent', { Count: '42 Pods', EnzymeFormula: 'Tough on Stains' }, ['laundry', 'detergent', 'household']),
  P('Premium Extra Virgin Olive Oil', 21, 28, 'Grocery', 'Pantry Staples', 'FarmBowl', 70, 'photo-1474979266404-7eaacbcd87c5', false, { isBestSeller: true }, 4.8, 290, 'Olive Oil', { Volume: '750 ml', Extraction: 'Cold Pressed Single Estate' }, ['olive oil', 'cooking', 'healthy']),
  P('Aged Basmati Rice 5kg', 19, 25, 'Grocery', 'Pantry Staples', 'FreshBasket', 90, 'photo-1586201375761-83865001e31c', false, {}, 4.6, 210, 'Rice', { Weight: '5 kg', Grain: 'Long Grain Extra Aroma' }, ['rice', 'basmati', 'grain']),
  P('Raw Organic Forest Honey', 15, 20, 'Grocery', 'Organic', 'FarmBowl', 80, 'photo-1587049352846-4a222e784d38', false, {}, 4.7, 175, 'Honey', { Weight: '500 g', Processing: 'Unpasteurized Raw' }, ['honey', 'organic', 'natural']),
  P('Organic Quinoa Grains 1kg', 12, 16, 'Grocery', 'Organic', 'FarmBowl', 95, 'photo-1543353071-873f17a7a088', false, {}, 4.4, 120, 'Grain', { Weight: '1 kg', GlutenFree: 'Yes', Protein: '14g per 100g' }, ['quinoa', 'superfood', 'organic']),

  // ===================== TOYS & MORE (12 products) =====================
  P('STEM Engineering Building Blocks', 44, 55, 'Toys & More', 'Toys & Games', 'BrightPlay', 62, 'photo-1587654780291-39c9404d746b', false, { isFeatured: true }, 4.7, 245, 'Building Blocks', { Pieces: '380 pieces', AgeGroup: '6-14 years', Motors: '2 included' }, ['stem', 'lego', 'engineering', 'blocks']),
  P('Programmable Smart Toy Robot', 69, 89, 'Toys & More', 'Toys & Games', 'BrightPlay', 35, 'photo-1485827404703-89b55fcc595e', false, { isNew: true }, 4.6, 170, 'Robot', { Control: 'App & Voice Control', Features: 'Dancing, obstacle sensing' }, ['robot', 'tech toy', 'kids']),
  P('Wooden 1000-Piece Jigsaw Puzzle', 24, 32, 'Toys & More', 'Toys & Games', 'BrightPlay', 55, 'photo-1580584126903-c17d41830450', false, {}, 4.4, 130, 'Puzzle', { Pieces: '1000', Theme: 'World Landmarks', Material: 'Recycled Wood' }, ['puzzle', 'family', 'game']),
  P('Remote Control Speed Racer', 39, 49, 'Toys & More', 'Toys & Games', 'PlayPlus', 48, 'photo-1594787318286-3d835c1d207f', false, { isBestSeller: true }, 4.5, 210, 'RC Car', { Speed: '25 km/h', Scale: '1:16', Battery: 'Rechargeable 7.4V' }, ['rc car', 'remote control', 'toy']),
  P('Mini Drone Explorer HD', 79, 99, 'Toys & More', 'Gadgets', 'SkyKid', 21, 'photo-1473968512647-3e447244af8f', false, { isNew: true }, 4.1, 128, 'Drone', { Camera: '1080p HD', FlightTime: '15 min', AltitudeHold: 'Yes' }, ['drone', 'gadget', 'flying']),
  P('LED Star Projector Night Light', 32, 42, 'Toys & More', 'Gadgets', 'GadgetLane', 60, 'photo-1517865288-978fcb780658', false, {}, 4.5, 195, 'Projector', { Modes: '16 Color Scenes', BluetoothSpeaker: 'Yes', Timer: 'Auto-off' }, ['projector', 'night light', 'bedroom']),
  P('Orthopedic Cozy Pet Bed', 42, 55, 'Toys & More', 'Pet Supplies', 'PawNest', 36, 'photo-1548199973-03cce0bbc87b', false, {}, 4.5, 172, 'Pet Bed', { Size: 'Large (36 x 27 inch)', Base: 'Egg-Crate Orthopedic Foam', Cover: 'Washable' }, ['pet', 'dog bed', 'cat']),
  P('Automatic Pet Water Fountain', 35, 45, 'Toys & More', 'Pet Supplies', 'PawNest', 50, 'photo-1543466835-00a7907e9de1', false, {}, 4.4, 145, 'Pet Feeder', { Capacity: '2.5 Litres', Filter: 'Triple Carbon Filter' }, ['pet fountain', 'cats', 'dogs']),
  P('Digital Luggage Scale 50kg', 18, null, 'Toys & More', 'Travel Accessories', 'TravelMate', 68, 'photo-1488646953014-85cb44e25828', false, {}, 4.0, 72, 'Scale', { MaxWeight: '50 kg / 110 lb', Display: 'Backlit LCD', Battery: 'Included CR2032' }, ['travel', 'scale', 'luggage']),
  P('Memory Foam Travel Neck Pillow', 25, 34, 'Toys & More', 'Travel Accessories', 'TravelMate', 80, 'photo-1544620347-c4fd4a3d5957', false, {}, 4.5, 230, 'Travel Pillow', { Fill: 'Pure Memory Foam', Cover: 'Breathable Velvet' }, ['travel', 'pillow', 'airplane']),
  P('Reusable Cotton Gift Wrap Kit', 21, null, 'Toys & More', 'General Products', 'WrapWell', 45, 'photo-1512909006721-3d6018887383', false, {}, 4.2, 65, 'Gift Wrap', { Count: '6 Cloth Wraps', Technique: 'Japanese Furoshiki' }, ['gift', 'wrap', 'eco-friendly']),
  P('Multi-Tool Pocket Keychain', 16, 22, 'Toys & More', 'General Products', 'PlayPlus', 90, 'photo-1510519138161-58474ebf8282', false, {}, 4.3, 140, 'Multi-tool', { Functions: '10 Tools in 1', Material: 'Stainless Steel' }, ['edc', 'gadget', 'keychain'])
];

const storeForProduct = (p) => {
  const byCategory = {
    Electronics: {
      NovaTech: 'TechSquare', Aster: 'TechSquare', Arcade: 'GadgetLane',
      Pulse: 'AudioBay', AudioBay: 'AudioBay', Orbit: 'TechSquare',
      VividShot: 'GadgetLane', SonicHome: 'AudioBay', DeskHub: 'GadgetLane', ViewPoint: 'TechSquare'
    },
    Clothing: {
      UrbanWear: 'UrbanWear', 'North & Loom': 'UrbanWear', UrbanFit: 'UrbanWear',
      Arden: 'UrbanWear', BlueForge: 'UrbanWear', Harbor: 'UrbanWear',
      Trailmark: 'StyleMarket', Elara: 'StyleMarket', Stride: 'UrbanWear',
      ActiveZone: 'ActiveZone', TinyTrail: 'StyleMarket', Rang: 'StyleMarket',
      KadaWear: 'UrbanWear'
    },
    'Home & Living': {
      ErgoFlex: 'HomeWorks', HomeWorks: 'HomeWorks', Dwell: 'HomeWorks',
      GlowRoom: 'HomeWorks', BrewNest: 'HomeWorks', Tablely: 'DailyHome',
      NeatStack: 'DailyHome', Casa: 'DailyHome', SleepWell: 'DailyHome', DailyHome: 'DailyHome'
    },
    Beauty: { ClearLeaf: 'GlowMart', GlowMart: 'GlowMart', Muse: 'GlowMart', AirSilk: 'GlowMart', Botanica: 'GlowMart' },
    Sports: { Stride: 'ActiveZone', FlexiFit: 'ActiveZone', GoalPro: 'ActiveZone', ActiveZone: 'ActiveZone', HydroPeak: 'ActiveZone', Trailmark: 'ActiveZone' },
    Books: { CodePress: 'BookCorner', BlueRiver: 'BookCorner', Paperly: 'BookCorner', Artline: 'BookCorner' },
    Grocery: { FarmBowl: 'FreshBasket', NutriJar: 'FreshBasket', RoastLab: 'FreshBasket', FreshBasket: 'FreshBasket', FizzCo: 'FreshBasket', PureHome: 'FreshBasket' },
    'Toys & More': { BrightPlay: 'PlayPlus', PlayPlus: 'PlayPlus', SkyKid: 'PlayPlus', GadgetLane: 'GadgetLane', PawNest: 'PlayPlus', TravelMate: 'PlayPlus', WrapWell: 'PlayPlus' }
  };
  return (byCategory[p.category] || {})[p.brand] || 'UrbanWear';
};

const descriptionFor = (p) => `${p.name} by ${p.brand}. High quality ${p.productType.toLowerCase()} designed for durability, reliability, and everyday performance.`;

const run = async (client) => {
  console.log('Seeding database with expanded catalog...');
  {
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
    const subcategoryValues = [];
    const subcategoryParams = [];
    let subParamIdx = 1;

    for (const c of CATEGORIES) {
      const { rows } = await client.query(
        'INSERT INTO categories (name, slug, description, image, icon) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [c.name, c.slug, c.description, c.image, c.icon]
      );
      catIdByName[c.name] = rows[0].id;
      for (const sub of c.subcategories) {
        subcategoryValues.push(`($${subParamIdx++}, $${subParamIdx++})`);
        subcategoryParams.push(rows[0].id, sub);
      }
    }
    if (subcategoryValues.length) {
      await client.query(
        `INSERT INTO category_subcategories (category_id, name) VALUES ${subcategoryValues.join(',')}`,
        subcategoryParams
      );
    }

    // Products (+images). Brand storefronts map to their seller.
    const productIdByName = {};
    const allImagesToInsert = [];
    const CHUNK_SIZE = 25;

    for (let i = 0; i < PRODUCTS.length; i += CHUNK_SIZE) {
      const chunk = PRODUCTS.slice(i, i + CHUNK_SIZE);
      const valueClauses = [];
      const params = [];
      let pIdx = 1;

      for (const p of chunk) {
        const store = storeForProduct(p);
        const sellerId = sellerIdByStore[store] || demoSellerId;
        const discount = p.originalPrice ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0;
        valueClauses.push(`($${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++})`);
        params.push(
          sellerId, catIdByName[p.category], p.subcategory, p.name, p.price, p.originalPrice, discount,
          p.brand, p.rating, p.reviews, p.stock, JSON.stringify(p.specs), JSON.stringify(p.tags),
          !!p.isFeatured, !!p.isNew, !!p.isBestSeller, p.tryOn && p.category === 'Clothing', p.productType,
          descriptionFor(p)
        );
      }

      const { rows } = await client.query(
        `INSERT INTO products (seller_id, category_id, subcategory, name, price, original_price, discount,
           brand, rating, review_count, stock, specifications, tags, is_featured, is_new, is_best_seller,
           is_virtual_try_on_supported, product_type, description)
         VALUES ${valueClauses.join(',')} RETURNING id, name`,
        params
      );

      for (let j = 0; j < chunk.length; j++) {
        const p = chunk[j];
        const pid = rows[j].id;
        productIdByName[p.name] = pid;
        allImagesToInsert.push({ pid, url: p.image, sortOrder: 0, isTryOn: p.tryOn && p.category === 'Clothing' });
        if (p.extraImages && p.extraImages.length) {
          for (let k = 0; k < p.extraImages.length; k++) {
            allImagesToInsert.push({ pid, url: p.extraImages[k], sortOrder: k + 1, isTryOn: false });
          }
        }
      }
    }

    // Batch insert product images in chunks of 50
    for (let i = 0; i < allImagesToInsert.length; i += 50) {
      const imgChunk = allImagesToInsert.slice(i, i + 50);
      const imgValues = [];
      const imgParams = [];
      let iIdx = 1;
      for (const imgItem of imgChunk) {
        imgValues.push(`($${iIdx++},$${iIdx++},$${iIdx++},$${iIdx++})`);
        imgParams.push(imgItem.pid, imgItem.url, imgItem.sortOrder, imgItem.isTryOn);
      }
      await client.query(
        `INSERT INTO product_images (product_id, url, sort_order, is_try_on_reference) VALUES ${imgValues.join(',')}`,
        imgParams
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
      items: [
        [productIdByName['Ultrabook Pro 14'], 1],
        [productIdByName['Classic Cotton T-Shirt'], 2],
        [productIdByName['Barista Espresso Coffee Maker'], 1]
      ]
    });
    await seedOrder(client, {
      customerId, deliveryId, orderNumber: 'EC10351', status: 'Delivered', daysAgo: 14,
      items: [
        [productIdByName['Modern TypeScript Handbook'], 1],
        [productIdByName['Cold Brew Coffee Concentrate'], 3]
      ]
    });

    console.log(`Seeded: ${USERS.length} users, ${CATEGORIES.length} categories, ${PRODUCTS.length} products, 2 sample orders.`);
  }
};

const seedOrder = async (client, { customerId, deliveryId, orderNumber, status, daysAgo, items }) => {
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

/** Run the seed inside one transaction (rolls back fully on error). */
const seedDatabase = () => withTransaction(run);

module.exports = { seedDatabase };

// CLI: `npm run seed`
if (require.main === module) {
  seedDatabase()
    .catch((err) => { console.error('Seed failed:', err); process.exitCode = 1; })
    .finally(() => pool.end());
}
