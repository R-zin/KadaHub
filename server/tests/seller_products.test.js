const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, seedFixtures, closeDb } = require('./helpers');
const { pool } = require('../src/db');
const bcrypt = require('bcryptjs');

let server;
let fixtures;
let sellerToken;
let otherSellerToken;
let customerToken;
let sellerId;
let otherSellerId;
let createdProductId;

before(async () => {
  server = await startServer();
  fixtures = await seedFixtures();

  // Populate subcategories for multiple categories in the test database
  await pool.query(`
    INSERT INTO categories (name, slug)
    VALUES 
      ('Electronics', 'electronics'),
      ('Home & Living', 'home-living'),
      ('Grocery', 'grocery'),
      ('Sports', 'sports')
    ON CONFLICT (slug) DO NOTHING
  `);

  // Ensure category_subcategories exist for test categories
  const { rows: cats } = await pool.query('SELECT id, name FROM categories');
  const catMap = Object.fromEntries(cats.map(c => [c.name, c.id]));

  const subcats = [
    // Clothing
    { cat: 'Clothing', name: 'T-Shirts' },
    { cat: 'Clothing', name: 'Shirts' },
    { cat: 'Clothing', name: 'Jeans' },
    { cat: 'Clothing', name: 'Dresses' },
    { cat: 'Clothing', name: 'Hoodies' },
    // Electronics
    { cat: 'Electronics', name: 'Smartphones' },
    { cat: 'Electronics', name: 'Laptops' },
    { cat: 'Electronics', name: 'Headphones' },
    // Home & Living
    { cat: 'Home & Living', name: 'Furniture' },
    { cat: 'Home & Living', name: 'Kitchenware' },
    // Grocery
    { cat: 'Grocery', name: 'Beverages' },
    { cat: 'Grocery', name: 'Food & Snacks' },
    // Sports
    { cat: 'Sports', name: 'Fitness Equipment' },
    { cat: 'Sports', name: 'Sportswear' }
  ];

  for (const s of subcats) {
    if (catMap[s.cat]) {
      await pool.query(
        'INSERT INTO category_subcategories (category_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [catMap[s.cat], s.name]
      );
    }
  }

  // Create Seller B
  const hash = await bcrypt.hash('password123', 10);
  const sellerB = await pool.query(
    "INSERT INTO users (name,email,password_hash,role,store_name) VALUES ('Seller B','sellerb@test.com',$1,'seller','SellerB Store') RETURNING id",
    [hash]
  );
  otherSellerId = sellerB.rows[0].id;

  // Log in
  const sLogin = await server.client.post('/api/auth/login', { email: 'seller@test.com', password: 'password123' });
  sellerToken = sLogin.body.token;
  sellerId = sLogin.body.user.id;

  const sBLogin = await server.client.post('/api/auth/login', { email: 'sellerb@test.com', password: 'password123' });
  otherSellerToken = sBLogin.body.token;

  const cReg = await server.client.post('/api/auth/register', {
    name: 'Customer Shopper', email: 'shopper@test.com', password: 'password123', role: 'customer'
  });
  customerToken = cReg.body.token;
});

after(async () => {
  await server.close();
  await closeDb();
});

test('Section 12: Create test product "Classic Black Cotton T-Shirt" with 3 images & full attributes', async () => {
  const images = [
    'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800',
    'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800',
    'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800'
  ];

  const payload = {
    name: 'Classic Black Cotton T-Shirt',
    description: 'Comfortable everyday cotton T-shirt suitable for casual wear.',
    brand: 'KadaWear',
    category: 'Clothing',
    subcategory: 'T-Shirts',
    productType: 'T-Shirt',
    price: 799,
    originalPrice: 999,
    discount: 20,
    stock: 50,
    specifications: {
      Material: 'Cotton',
      Colour: 'Black',
      Size: 'S, M, L, XL'
    },
    tags: ['casual', 'cotton', 'black', 't-shirt'],
    images,
    isVirtualTryOnSupported: true
  };

  const res = await server.client.post('/api/products', payload, { token: sellerToken });
  assert.equal(res.status, 201);
  const p = res.body.product;
  createdProductId = p.id;

  // 1. Product created
  assert.ok(p.id);
  assert.equal(p.name, 'Classic Black Cotton T-Shirt');
  assert.equal(p.brand, 'KadaWear');
  assert.equal(p.description, 'Comfortable everyday cotton T-shirt suitable for casual wear.');
  assert.equal(p.price, 799);
  assert.equal(p.originalPrice, 999);
  assert.equal(p.discount, 20);

  // 2 & 3. Images uploaded and saved
  assert.equal(p.images.length, 3);

  // 4. Correct primary image (first image)
  assert.equal(p.images[0], images[0]);

  // 5. Correct category
  assert.equal(p.category, 'Clothing');

  // 6. Correct subcategory
  assert.equal(p.subcategory, 'T-Shirts');

  // 7. Correct product type
  assert.equal(p.productType, 'T-Shirt');

  // 8. Specifications saved
  assert.deepEqual(p.specifications, {
    Material: 'Cotton',
    Colour: 'Black',
    Size: 'S, M, L, XL'
  });

  // 9. Tags saved
  assert.deepEqual(p.tags, ['casual', 'cotton', 'black', 't-shirt']);

  // 10. Stock saved
  assert.equal(p.stock, 50);

  // 11. Appears in seller dashboard (backend filtered)
  const sellerList = await server.client.get(`/api/products?sellerId=${sellerId}`);
  assert.equal(sellerList.status, 200);
  assert.ok(sellerList.body.products.some(item => item.id === createdProductId));

  // 12. Appears in public catalog
  const catalog = await server.client.get(`/api/products?category=Clothing&subcategory=T-Shirts`);
  assert.equal(catalog.status, 200);
  assert.ok(catalog.body.products.some(item => item.id === createdProductId));

  // 13. Product details page works
  const detail = await server.client.get(`/api/products/${createdProductId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.product.name, 'Classic Black Cotton T-Shirt');

  // 14. Product can be added to cart
  const cartRes = await server.client.post('/api/cart/items', { productId: createdProductId, quantity: 1 }, { token: customerToken });
  assert.equal(cartRes.status, 201);
  assert.ok(cartRes.body.cart.some(item => item.product.id === createdProductId));
});

test('Section 13: Test Multiple Categories (Electronics, Home & Living, Grocery, Sports)', async () => {
  // 1. Electronics -> Laptops
  const elec = await server.client.post('/api/products', {
    name: 'Test Pro Laptop',
    brand: 'TechBrand',
    category: 'Electronics',
    subcategory: 'Laptops',
    productType: 'Laptop',
    price: 1299,
    stock: 20
  }, { token: sellerToken });
  assert.equal(elec.status, 201);
  assert.equal(elec.body.product.category, 'Electronics');
  assert.equal(elec.body.product.subcategory, 'Laptops');
  assert.equal(elec.body.product.productType, 'Laptop');

  // 2. Home & Living -> Furniture
  const home = await server.client.post('/api/products', {
    name: 'Modern Study Table',
    brand: 'HomeDec',
    category: 'Home & Living',
    subcategory: 'Furniture',
    productType: 'Study Table',
    price: 249,
    stock: 15
  }, { token: sellerToken });
  assert.equal(home.status, 201);
  assert.equal(home.body.product.category, 'Home & Living');
  assert.equal(home.body.product.subcategory, 'Furniture');

  // 3. Grocery -> Beverages
  const groc = await server.client.post('/api/products', {
    name: 'Artisan Dark Roast Coffee',
    brand: 'BrewMaster',
    category: 'Grocery',
    subcategory: 'Beverages',
    productType: 'Coffee',
    price: 18,
    stock: 100
  }, { token: sellerToken });
  assert.equal(groc.status, 201);
  assert.equal(groc.body.product.category, 'Grocery');
  assert.equal(groc.body.product.subcategory, 'Beverages');

  // 4. Sports -> Fitness Equipment
  const sports = await server.client.post('/api/products', {
    name: 'Pro Grip Dumbbells',
    brand: 'FitLife',
    category: 'Sports',
    subcategory: 'Fitness Equipment',
    productType: 'Dumbbells',
    price: 65,
    stock: 30
  }, { token: sellerToken });
  assert.equal(sports.status, 201);
  assert.equal(sports.body.product.category, 'Sports');
  assert.equal(sports.body.product.subcategory, 'Fitness Equipment');
});

test('Section 4 & 13: Reject invalid category/subcategory combinations with 400 Bad Request', async () => {
  // Electronics + Dresses -> 400
  const bad1 = await server.client.post('/api/products', {
    name: 'Impossible Product 1',
    category: 'Electronics',
    subcategory: 'Dresses',
    price: 100,
    stock: 10
  }, { token: sellerToken });
  assert.equal(bad1.status, 400);
  assert.match(bad1.body.error.message, /Subcategory .* is not valid for category/i);

  // Clothing + Smartphones -> 400
  const bad2 = await server.client.post('/api/products', {
    name: 'Impossible Product 2',
    category: 'Clothing',
    subcategory: 'Smartphones',
    price: 100,
    stock: 10
  }, { token: sellerToken });
  assert.equal(bad2.status, 400);
  assert.match(bad2.body.error.message, /Subcategory .* is not valid for category/i);

  // Grocery + Laptops -> 400
  const bad3 = await server.client.post('/api/products', {
    name: 'Impossible Product 3',
    category: 'Grocery',
    subcategory: 'Laptops',
    price: 100,
    stock: 10
  }, { token: sellerToken });
  assert.equal(bad3.status, 400);
  assert.match(bad3.body.error.message, /Subcategory .* is not valid for category/i);
});

test('Section 8: Product Editing & Seller Ownership Security', async () => {
  // Legitimate owner edits product
  const updateRes = await server.client.put(`/api/products/${createdProductId}`, {
    price: 849,
    description: 'Updated comfortable everyday cotton T-shirt.',
    stock: 45
  }, { token: sellerToken });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.product.price, 849);
  assert.equal(updateRes.body.product.stock, 45);

  // Other seller blocked from editing
  const unauthorizedEdit = await server.client.put(`/api/products/${createdProductId}`, {
    price: 1
  }, { token: otherSellerToken });
  assert.equal(unauthorizedEdit.status, 403);
});

test('Section 11: Inventory Stock Validation', async () => {
  // Negative stock rejected
  const negative = await server.client.patch(`/api/products/${createdProductId}/stock`, { stock: -10 }, { token: sellerToken });
  assert.equal(negative.status, 400);

  // Non-integer stock rejected
  const nonInt = await server.client.patch(`/api/products/${createdProductId}/stock`, { stock: 12.5 }, { token: sellerToken });
  assert.equal(nonInt.status, 400);

  // Valid stock update succeeds
  const okStock = await server.client.patch(`/api/products/${createdProductId}/stock`, { stock: 60 }, { token: sellerToken });
  assert.equal(okStock.status, 200);
  assert.equal(okStock.body.product.stock, 60);
});

test('Section 9: Product Deletion and Historical Order Protection', async () => {
  // Create standalone product without orders
  const temp = await server.client.post('/api/products', {
    name: 'Temporary Product',
    category: 'Clothing',
    subcategory: 'T-Shirts',
    price: 50,
    stock: 5
  }, { token: sellerToken });
  const tempId = temp.body.product.id;

  // Other seller cannot delete it
  const forbidDelete = await server.client.del(`/api/products/${tempId}`, { token: otherSellerToken });
  assert.equal(forbidDelete.status, 403);

  // Legitimate owner can delete standalone product
  const okDelete = await server.client.del(`/api/products/${tempId}`, { token: sellerToken });
  assert.equal(okDelete.status, 204);

  // Attempting to delete a product that has historical orders is rejected with 400
  // Insert a mock order_item reference for createdProductId
  const ord = await pool.query(
    "INSERT INTO orders (order_number, customer_id, total, status) VALUES ('ORD-HIST-01', $1, 849, 'Delivered') RETURNING id",
    [sellerId]
  );
  await pool.query(
    "INSERT INTO order_items (order_id, product_id, quantity, unit_price, product_name) VALUES ($1, $2, 1, 849, 'Classic Black Cotton T-Shirt')",
    [ord.rows[0].id, createdProductId]
  );

  const blockedDelete = await server.client.del(`/api/products/${createdProductId}`, { token: sellerToken });
  assert.equal(blockedDelete.status, 400);
  assert.match(blockedDelete.body.error.message, /Cannot delete a product with existing order history/i);
});
