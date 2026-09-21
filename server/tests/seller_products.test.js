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

test('Phase 2: Product Creation Validation Edge Cases', async () => {
  // 1. Missing name
  const missingName = await server.client.post('/api/products', {
    price: 100, category: 'Clothing', subcategory: 'T-Shirts'
  }, { token: sellerToken });
  assert.equal(missingName.status, 400);
  assert.match(missingName.body.error.message, /Product name is required/i);

  // 2. Whitespace-only name
  const whitespaceName = await server.client.post('/api/products', {
    name: '   ', price: 100, category: 'Clothing', subcategory: 'T-Shirts'
  }, { token: sellerToken });
  assert.equal(whitespaceName.status, 400);
  assert.match(whitespaceName.body.error.message, /Product name is required/i);

  // 3. Long product name (> 180 chars)
  const longName = await server.client.post('/api/products', {
    name: 'A'.repeat(181), price: 100, category: 'Clothing', subcategory: 'T-Shirts'
  }, { token: sellerToken });
  assert.equal(longName.status, 400);
  assert.match(longName.body.error.message, /Product name cannot exceed 180 characters/i);

  // 4. Missing description -> creates successfully with empty description
  const missingDesc = await server.client.post('/api/products', {
    name: 'No Description Tee', price: 150, category: 'Clothing', subcategory: 'T-Shirts'
  }, { token: sellerToken });
  assert.equal(missingDesc.status, 201);
  assert.equal(missingDesc.body.product.description, '');

  // 5. Long description (> 10000 chars)
  const longDesc = await server.client.post('/api/products', {
    name: 'Long Description Product', description: 'x'.repeat(10001), price: 100, category: 'Clothing', subcategory: 'T-Shirts'
  }, { token: sellerToken });
  assert.equal(longDesc.status, 400);
  assert.match(longDesc.body.error.message, /Product description cannot exceed 10000 characters/i);

  // 6. Missing price
  const missingPrice = await server.client.post('/api/products', {
    name: 'No Price Product', category: 'Clothing', subcategory: 'T-Shirts'
  }, { token: sellerToken });
  assert.equal(missingPrice.status, 400);
  assert.match(missingPrice.body.error.message, /Valid price \(> 0\) is required/i);

  // 7. Invalid price string
  const invalidPrice = await server.client.post('/api/products', {
    name: 'Invalid Price Product', price: 'abc', category: 'Clothing', subcategory: 'T-Shirts'
  }, { token: sellerToken });
  assert.equal(invalidPrice.status, 400);
  assert.match(invalidPrice.body.error.message, /Valid price \(> 0\) is required/i);

  // 8. Zero price
  const zeroPrice = await server.client.post('/api/products', {
    name: 'Zero Price Product', price: 0, category: 'Clothing', subcategory: 'T-Shirts'
  }, { token: sellerToken });
  assert.equal(zeroPrice.status, 400);
  assert.match(zeroPrice.body.error.message, /Valid price \(> 0\) is required/i);

  // 9. Negative price
  const negPrice = await server.client.post('/api/products', {
    name: 'Negative Price Product', price: -25, category: 'Clothing', subcategory: 'T-Shirts'
  }, { token: sellerToken });
  assert.equal(negPrice.status, 400);
  assert.match(negPrice.body.error.message, /Valid price \(> 0\) is required/i);

  // 10. Invalid stock string
  const invalidStock = await server.client.post('/api/products', {
    name: 'Invalid Stock Product', price: 100, stock: 'invalid', category: 'Clothing', subcategory: 'T-Shirts'
  }, { token: sellerToken });
  assert.equal(invalidStock.status, 400);
  assert.match(invalidStock.body.error.message, /Stock must be a non-negative integer/i);

  // 11. Non-integer stock
  const nonIntStock = await server.client.post('/api/products', {
    name: 'Decimal Stock Product', price: 100, stock: 12.5, category: 'Clothing', subcategory: 'T-Shirts'
  }, { token: sellerToken });
  assert.equal(nonIntStock.status, 400);
  assert.match(nonIntStock.body.error.message, /Stock must be a non-negative integer/i);

  // 12. Negative stock
  const negStock = await server.client.post('/api/products', {
    name: 'Negative Stock Product', price: 100, stock: -5, category: 'Clothing', subcategory: 'T-Shirts'
  }, { token: sellerToken });
  assert.equal(negStock.status, 400);
  assert.match(negStock.body.error.message, /Stock must be a non-negative integer/i);

  // 13. Missing category
  const missingCat = await server.client.post('/api/products', {
    name: 'No Category Product', price: 100
  }, { token: sellerToken });
  assert.equal(missingCat.status, 400);
  assert.match(missingCat.body.error.message, /Category is required/i);

  // 14. Unknown category
  const unknownCat = await server.client.post('/api/products', {
    name: 'Unknown Category Product', price: 100, category: 'SpaceCraft'
  }, { token: sellerToken });
  assert.equal(unknownCat.status, 400);
  assert.match(unknownCat.body.error.message, /Unknown category/i);

  // 15. No image -> product created with empty images array
  const noImg = await server.client.post('/api/products', {
    name: 'No Images Product', price: 100, category: 'Clothing', subcategory: 'T-Shirts', images: []
  }, { token: sellerToken });
  assert.equal(noImg.status, 201);
  assert.deepEqual(noImg.body.product.images, []);

  // 16. Long image URL (> 500 chars)
  const longImg = await server.client.post('/api/products', {
    name: 'Long Image URL Product', price: 100, category: 'Clothing', subcategory: 'T-Shirts',
    images: ['https://example.com/' + 'a'.repeat(500)]
  }, { token: sellerToken });
  assert.equal(longImg.status, 400);
  assert.match(longImg.body.error.message, /Image URL cannot exceed 500 characters/i);

  // 17. Special characters in name, description, specifications, and tags
  const specialPayload = {
    name: 'Men\'s "Pro-Fit" T-Shirt (100% Cotton) & Élan ⚡',
    description: 'Features & Benefits: <Premium> 100% Cotton & "Eco-Friendly" — \'Top Quality\' 👍',
    price: 499,
    category: 'Clothing',
    subcategory: 'T-Shirts',
    specifications: {
      'Dimension & Size': '10" x 12" & L',
      'Fabric': '100% Coton / Élasthanne'
    },
    tags: ['men\'s', '100%-cotton', 'pro-fit', 'élan']
  };
  const specialRes = await server.client.post('/api/products', specialPayload, { token: sellerToken });
  assert.equal(specialRes.status, 201);
  assert.equal(specialRes.body.product.name, specialPayload.name);
  assert.equal(specialRes.body.product.description, specialPayload.description);
  assert.deepEqual(specialRes.body.product.specifications, specialPayload.specifications);
  assert.deepEqual(specialRes.body.product.tags, specialPayload.tags);
});

test('Phase 2: Product Editing, Primary Image & Image Ordering Management', async () => {
  // Create product with 3 images
  const img1 = 'https://images.unsplash.com/photo-1?w=500';
  const img2 = 'https://images.unsplash.com/photo-2?w=500';
  const img3 = 'https://images.unsplash.com/photo-3?w=500';

  const created = await server.client.post('/api/products', {
    name: 'Image Test Product',
    price: 300,
    stock: 25,
    category: 'Clothing',
    subcategory: 'T-Shirts',
    images: [img1, img2, img3]
  }, { token: sellerToken });
  assert.equal(created.status, 201);
  const pId = created.body.product.id;
  assert.equal(created.body.product.images[0], img1);

  // 1. Reorder images: promote img2 to primary
  const reorderRes = await server.client.put(`/api/products/${pId}`, {
    images: [img2, img1, img3]
  }, { token: sellerToken });
  assert.equal(reorderRes.status, 200);
  assert.equal(reorderRes.body.product.images[0], img2);
  assert.equal(reorderRes.body.product.images[1], img1);
  assert.equal(reorderRes.body.product.images[2], img3);

  // 2. Delete an image: remove img1 from the array
  const deleteImgRes = await server.client.put(`/api/products/${pId}`, {
    images: [img2, img3]
  }, { token: sellerToken });
  assert.equal(deleteImgRes.status, 200);
  assert.equal(deleteImgRes.body.product.images.length, 2);
  assert.equal(deleteImgRes.body.product.images[0], img2);
  assert.equal(deleteImgRes.body.product.images[1], img3);

  // 3. Update specifications and tags
  const specRes = await server.client.put(`/api/products/${pId}`, {
    specifications: { Fit: 'Slim', Wash: 'Machine' },
    tags: ['slim', 'cotton']
  }, { token: sellerToken });
  assert.equal(specRes.status, 200);
  assert.deepEqual(specRes.body.product.specifications, { Fit: 'Slim', Wash: 'Machine' });
  assert.deepEqual(specRes.body.product.tags, ['slim', 'cotton']);

  // 4. Reject editing with invalid price (<= 0)
  const badPriceEdit = await server.client.put(`/api/products/${pId}`, {
    price: 0
  }, { token: sellerToken });
  assert.equal(badPriceEdit.status, 400);

  // 5. Reject editing with empty name
  const emptyNameEdit = await server.client.put(`/api/products/${pId}`, {
    name: '  '
  }, { token: sellerToken });
  assert.equal(emptyNameEdit.status, 400);

  // 6. Reject editing non-existent product
  const notFoundEdit = await server.client.put('/api/products/999999', {
    price: 100
  }, { token: sellerToken });
  assert.equal(notFoundEdit.status, 404);

  // 7. Reject editing product with invalid ID
  const invalidIdEdit = await server.client.put('/api/products/not-an-id', {
    price: 100
  }, { token: sellerToken });
  assert.equal(invalidIdEdit.status, 404);

  // 8. Reject unauthorized edit by customer
  const customerEdit = await server.client.put(`/api/products/${pId}`, {
    price: 10
  }, { token: customerToken });
  assert.equal(customerEdit.status, 403);
});

test('Phase 2: Product Deletion Safety, Repeated Deletion & Reference Protection', async () => {
  // Create disposable product
  const disp = await server.client.post('/api/products', {
    name: 'Disposable Product',
    price: 100,
    category: 'Clothing',
    subcategory: 'T-Shirts'
  }, { token: sellerToken });
  const dispId = disp.body.product.id;

  // 1. Customer cannot delete product
  const custDel = await server.client.del(`/api/products/${dispId}`, { token: customerToken });
  assert.equal(custDel.status, 403);

  // 2. Non-existent product deletion returns 404
  const notFoundDel = await server.client.del('/api/products/999999', { token: sellerToken });
  assert.equal(notFoundDel.status, 404);

  // 3. Normal deletion succeeds
  const okDel = await server.client.del(`/api/products/${dispId}`, { token: sellerToken });
  assert.equal(okDel.status, 204);

  // 4. Repeated deletion of already deleted product returns 404 Not Found
  const repeatDel = await server.client.del(`/api/products/${dispId}`, { token: sellerToken });
  assert.equal(repeatDel.status, 404);

  // 5. Product referenced by returns cannot be deleted
  const retProd = await server.client.post('/api/products', {
    name: 'Returned Item Product',
    price: 120,
    category: 'Clothing',
    subcategory: 'T-Shirts'
  }, { token: sellerToken });
  const retProdId = retProd.body.product.id;

  const retOrder = await pool.query(
    "INSERT INTO orders (order_number, customer_id, total, status) VALUES ('ORD-RET-TEST', $1, 120, 'Delivered') RETURNING id",
    [sellerId]
  );
  await pool.query(
    "INSERT INTO returns (order_id, product_id, customer_id, reason, status) VALUES ($1, $2, $3, 'Size too small', 'Requested')",
    [retOrder.rows[0].id, retProdId, sellerId]
  );

  const blockedByReturn = await server.client.del(`/api/products/${retProdId}`, { token: sellerToken });
  assert.equal(blockedByReturn.status, 400);
  assert.match(blockedByReturn.body.error.message, /Cannot delete a product with existing order history/i);
});

test('Phase 2: Image Upload Validation (MIME type & Size Limit)', async () => {
  // 1. Invalid file MIME type (text file instead of image)
  const fdText = new FormData();
  fdText.append('file', new Blob(['sample text data'], { type: 'text/plain' }), 'test.txt');
  const resText = await fetch(server.client.base + '/api/uploads', {
    method: 'POST',
    headers: { authorization: `Bearer ${sellerToken}` },
    body: fdText
  });
  assert.equal(resText.status, 400);
  const jsonText = await resText.json();
  assert.match(jsonText.error.message, /Only image uploads are allowed/i);

  // 2. File size exceeding 5MB
  const fdBig = new FormData();
  fdBig.append('image', new Blob([new Uint8Array(6 * 1024 * 1024)], { type: 'image/jpeg' }), 'big.jpg');
  const resBig = await fetch(server.client.base + '/api/uploads', {
    method: 'POST',
    headers: { authorization: `Bearer ${sellerToken}` },
    body: fdBig
  });
  assert.equal(resBig.status, 400);
  const jsonBig = await resBig.json();
  assert.match(jsonBig.error.message, /File too large/i);
});

test('Phase 2: Inventory Stock Management, Out of Stock Handling & Concurrency Safety', async () => {
  // Register dedicated customer for clean cart
  const shopper = await server.client.post('/api/auth/register', {
    name: 'Stock Shopper', email: `shopper_stock_${Date.now()}@test.com`, password: 'password123', role: 'customer'
  });
  assert.equal(shopper.status, 201);
  const shopperToken = shopper.body.token;

  // Create product with 5 in stock
  const invProd = await server.client.post('/api/products', {
    name: 'Stock Managed Tee',
    price: 200,
    stock: 5,
    category: 'Clothing',
    subcategory: 'T-Shirts'
  }, { token: sellerToken });
  assert.equal(invProd.status, 201);
  const pId = invProd.body.product.id;

  // 1. Customer adds product with stock 5 to cart
  const addCart = await server.client.post('/api/cart/items', { productId: pId, quantity: 1 }, { token: shopperToken });
  assert.equal(addCart.status, 201);

  // 2. Seller updates stock to 0 (out of stock while item is in customer's cart)
  const zeroStock = await server.client.patch(`/api/products/${pId}/stock`, { stock: 0 }, { token: sellerToken });
  assert.equal(zeroStock.status, 200);
  assert.equal(zeroStock.body.product.stock, 0);

  // 3. Adding an out-of-stock product directly to cart is rejected with 409 Conflict
  const addOos = await server.client.post('/api/cart/items', { productId: pId, quantity: 1 }, { token: shopperToken });
  assert.equal(addOos.status, 409);
  assert.match(addOos.body.error.message, /out of stock/i);

  // 4. Attempting to checkout when cart item has 0 available stock fails with 409 Conflict
  const checkoutFail = await server.client.post('/api/orders/checkout', {
    address: { name: 'Shopper', phone: '1234567890', line1: '123 Main St', city: 'City', region: 'Region', postalCode: '12345' },
    payment: { type: 'mock' }
  }, { token: shopperToken });
  assert.equal(checkoutFail.status, 409);
  assert.match(checkoutFail.body.error.message, /does not have enough stock/i);

  // 5. Replenish stock to 10
  const replenish = await server.client.patch(`/api/products/${pId}/stock`, { stock: 10 }, { token: sellerToken });
  assert.equal(replenish.status, 200);
  assert.equal(replenish.body.product.stock, 10);

  // 6. Now customer can check out successfully
  const checkoutOk = await server.client.post('/api/orders/checkout', {
    address: { name: 'Shopper', phone: '1234567890', line1: '123 Main St', city: 'City', region: 'Region', postalCode: '12345' },
    payment: { type: 'mock' }
  }, { token: shopperToken });
  assert.equal(checkoutOk.status, 201);

  // 7. Stock deduction verified: 10 - 1 = 9
  const afterOrder = await server.client.get(`/api/products/${pId}`);
  assert.equal(afterOrder.status, 200);
  assert.equal(afterOrder.body.product.stock, 9);

  // 8. Database constraint verification: stock cannot become negative in Postgres
  await assert.rejects(
    pool.query('UPDATE products SET stock = -1 WHERE id = $1', [pId]),
    /check constraint|violates check constraint/i
  );
});

test('Phase 2: Database Integrity (Foreign Keys & Historical Order Preservation)', async () => {
  // 1. Inserting product with invalid seller_id violates FK
  await assert.rejects(
    pool.query("INSERT INTO products (seller_id, category_id, name, price, stock) VALUES (999999, 1, 'Bad Seller', 100, 10)"),
    /foreign key constraint|violates foreign key constraint/i
  );

  // 2. Inserting product with invalid category_id violates FK
  await assert.rejects(
    pool.query("INSERT INTO products (seller_id, category_id, name, price, stock) VALUES ($1, 999999, 'Bad Cat', 100, 10)", [sellerId]),
    /foreign key constraint|violates foreign key constraint/i
  );

  // 3. Product images cascade delete when product is deleted
  const cascProd = await server.client.post('/api/products', {
    name: 'Cascade Test Product',
    price: 150,
    category: 'Clothing',
    subcategory: 'T-Shirts',
    images: ['https://example.com/casc1.jpg', 'https://example.com/casc2.jpg']
  }, { token: sellerToken });
  assert.equal(cascProd.status, 201);
  const cascId = cascProd.body.product.id;

  const { rows: imgsBefore } = await pool.query('SELECT * FROM product_images WHERE product_id = $1', [cascId]);
  assert.equal(imgsBefore.length, 2);

  const delRes = await server.client.del(`/api/products/${cascId}`, { token: sellerToken });
  assert.equal(delRes.status, 204);

  const { rows: imgsAfter } = await pool.query('SELECT * FROM product_images WHERE product_id = $1', [cascId]);
  assert.equal(imgsAfter.length, 0);
});

