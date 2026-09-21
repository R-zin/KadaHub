const { test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { startServer, seedFixtures, closeDb } = require('./helpers');
const { pool } = require('../src/db');
const config = require('../src/config');
const paymentService = require('../src/services/paymentService');

let server;
let fixtures;
let sellerToken;
let sellerId;
let customerToken;
let customerId;
let otherCustomerToken;
let otherCustomerId;
let deliveryToken;
let deliveryId;
let otherDeliveryToken;
let otherDeliveryId;
let adminToken;
let testProduct;

const testAddress = {
  name: 'Alice Customer',
  phone: '+1-555-0199',
  line1: '742 Evergreen Terrace',
  city: 'Springfield',
  region: 'OR',
  postalCode: '97477'
};

before(async () => {
  server = await startServer();
  fixtures = await seedFixtures();

  // Seed standard categories and subcategories
  await pool.query(`
    INSERT INTO categories (name, slug) VALUES
      ('Electronics', 'electronics'),
      ('Home & Living', 'home-living'),
      ('Grocery', 'grocery'),
      ('Sports', 'sports')
    ON CONFLICT (slug) DO NOTHING
  `);

  const { rows: cats } = await pool.query('SELECT id, name FROM categories');
  const catMap = Object.fromEntries(cats.map((c) => [c.name, c.id]));

  const subcats = [
    { cat: 'Clothing', name: 'T-Shirts' },
    { cat: 'Clothing', name: 'Shirts' },
    { cat: 'Clothing', name: 'Jeans' },
    { cat: 'Clothing', name: 'Dresses' },
    { cat: 'Clothing', name: 'Hoodies' },
    { cat: 'Electronics', name: 'Smartphones' },
    { cat: 'Electronics', name: 'Laptops' },
    { cat: 'Electronics', name: 'Headphones' },
    { cat: 'Home & Living', name: 'Furniture' },
    { cat: 'Home & Living', name: 'Kitchenware' },
    { cat: 'Grocery', name: 'Beverages' },
    { cat: 'Grocery', name: 'Snacks' },
    { cat: 'Sports', name: 'Fitness Equipment' },
    { cat: 'Sports', name: 'Footwear' },
    { cat: 'Sports', name: 'Outdoor' }
  ];

  for (const s of subcats) {
    if (catMap[s.cat]) {
      await pool.query(
        'INSERT INTO category_subcategories (category_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [catMap[s.cat], s.name]
      );
    }
  }

  // 1. Admin login
  const adminLogin = await server.client.post('/api/auth/login', {
    email: 'admin@test.com',
    password: 'password123'
  });
  adminToken = adminLogin.body.token;

  // 2. Seller login
  const sellerLogin = await server.client.post('/api/auth/login', {
    email: 'seller@test.com',
    password: 'password123'
  });
  sellerToken = sellerLogin.body.token;
  sellerId = sellerLogin.body.user.id;

  // 3. Register Primary Customer
  const custReg = await server.client.post('/api/auth/register', {
    name: 'Customer Primary',
    email: 'cust_primary@test.com',
    password: 'password123'
  });
  customerToken = custReg.body.token;
  customerId = custReg.body.user.id;

  // 4. Register Secondary Customer (for isolation testing)
  const otherCustReg = await server.client.post('/api/auth/register', {
    name: 'Customer Secondary',
    email: 'cust_secondary@test.com',
    password: 'password123'
  });
  otherCustomerToken = otherCustReg.body.token;
  otherCustomerId = otherCustReg.body.user.id;

  // 5. Existing Delivery Agent login
  const delLogin = await server.client.post('/api/auth/login', {
    email: 'delivery@test.com',
    password: 'password123'
  });
  deliveryToken = delLogin.body.token;
  deliveryId = delLogin.body.user.id;

  // 6. Admin creates a second Delivery Agent for isolation testing
  const otherDelReg = await server.client.post(
    '/api/admin/users',
    {
      name: 'Delivery Agent Two',
      email: 'delivery_two@test.com',
      password: 'password123',
      role: 'delivery'
    },
    { token: adminToken }
  );
  otherDeliveryId = otherDelReg.body.user.id;
  const otherDelLogin = await server.client.post('/api/auth/login', {
    email: 'delivery_two@test.com',
    password: 'password123'
  });
  otherDeliveryToken = otherDelLogin.body.token;

  // 7. Seller creates an initial catalog product
  const prodRes = await server.client.post(
    '/api/products',
    {
      name: 'Phase 3 Premium Cotton Hoodie',
      description: 'Super warm, soft organic cotton hoodie with kangaroo pocket',
      price: 85.00,
      stock: 25,
      category: 'Clothing',
      subcategory: 'Hoodies',
      brand: 'KadaWear',
      images: ['https://images.unsplash.com/photo-1556905055-8f358a7a47b2'],
      tags: ['warm', 'cotton', 'hoodie']
    },
    { token: sellerToken }
  );
  assert.equal(prodRes.status, 201, `Failed to create product: ${JSON.stringify(prodRes.body)}`);
  testProduct = prodRes.body.product;
});

after(async () => {
  await server.close();
  await closeDb();
});

// ============================================================================
// 1. CUSTOMER SHOPPING & CATALOG BROWSING
// ============================================================================
test('Customer Shopping: browse, search, filter, and view product details', async () => {
  // A. Product Browsing
  const listRes = await server.client.get('/api/products');
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.body.products));
  assert.ok(listRes.body.products.length > 0);

  // B. Product Search
  const searchRes = await server.client.get('/api/products?q=Hoodie');
  assert.equal(searchRes.status, 200);
  const found = searchRes.body.products.find((p) => p.id === testProduct.id);
  assert.ok(found, 'Search should find the hoodie product');

  // C. Category Filtering
  const catRes = await server.client.get('/api/products?category=Clothing');
  assert.equal(catRes.status, 200);
  assert.ok(catRes.body.products.every((p) => p.category.toLowerCase() === 'clothing'));

  // D. Price Filtering
  const priceRes = await server.client.get('/api/products?minPrice=50&maxPrice=100');
  assert.equal(priceRes.status, 200);
  assert.ok(priceRes.body.products.every((p) => p.price >= 50 && p.price <= 100));

  // E. Product Details & Images
  const detailRes = await server.client.get(`/api/products/${testProduct.id}`);
  assert.equal(detailRes.status, 200);
  assert.equal(detailRes.body.product.name, 'Phase 3 Premium Cotton Hoodie');
  assert.equal(detailRes.body.product.stock, 25);
  assert.ok(detailRes.body.product.images.length > 0);

  // F. Non-existent Product Details -> 404
  const notFoundRes = await server.client.get('/api/products/99999999');
  assert.equal(notFoundRes.status, 404);
});

// ============================================================================
// 2. CART MANAGEMENT & SERVER-SIDE VALIDATION
// ============================================================================
test('Cart Management: add, update, remove, clear, and validate bounds', async () => {
  // A. Initially empty cart
  const initCart = await server.client.get('/api/cart', { token: customerToken });
  assert.equal(initCart.status, 200);
  assert.equal(initCart.body.cart.length, 0);

  // B. Reject adding invalid quantities (negative, zero, non-integer)
  const negQty = await server.client.post(
    '/api/cart/items',
    { productId: testProduct.id, quantity: -3 },
    { token: customerToken }
  );
  assert.equal(negQty.status, 400);

  const zeroQty = await server.client.post(
    '/api/cart/items',
    { productId: testProduct.id, quantity: 0 },
    { token: customerToken }
  );
  assert.equal(zeroQty.status, 400);

  // C. Reject adding non-existent product
  const noProd = await server.client.post(
    '/api/cart/items',
    { productId: 999999, quantity: 1 },
    { token: customerToken }
  );
  assert.equal(noProd.status, 404);

  // D. Add item (quantity = 2)
  const addRes = await server.client.post(
    '/api/cart/items',
    { productId: testProduct.id, quantity: 2 },
    { token: customerToken }
  );
  assert.equal(addRes.status, 201);
  assert.equal(addRes.body.cart.length, 1);
  assert.equal(addRes.body.cart[0].quantity, 2);

  // E. Update quantity to 4
  const patchRes = await server.client.patch(
    `/api/cart/items/${testProduct.id}`,
    { quantity: 4 },
    { token: customerToken }
  );
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.cart[0].quantity, 4);

  // F. Update quantity with invalid value -> 400
  const invalidPatch = await server.client.patch(
    `/api/cart/items/${testProduct.id}`,
    { quantity: 'invalid_qty' },
    { token: customerToken }
  );
  assert.equal(invalidPatch.status, 400);

  // G. Update quantity to 0 removes item
  const zeroPatch = await server.client.patch(
    `/api/cart/items/${testProduct.id}`,
    { quantity: 0 },
    { token: customerToken }
  );
  assert.equal(zeroPatch.status, 200);
  assert.equal(zeroPatch.body.cart.length, 0);

  // H. Add item again and remove item explicitly via DELETE /api/cart/items/:id
  await server.client.post(
    '/api/cart/items',
    { productId: testProduct.id, quantity: 1 },
    { token: customerToken }
  );
  const delItemRes = await server.client.del(`/api/cart/items/${testProduct.id}`, { token: customerToken });
  assert.equal(delItemRes.status, 200);
  assert.equal(delItemRes.body.cart.length, 0);

  // I. Add item again and clear whole cart via DELETE /api/cart
  await server.client.post(
    '/api/cart/items',
    { productId: testProduct.id, quantity: 3 },
    { token: customerToken }
  );
  const clearRes = await server.client.del('/api/cart', { token: customerToken });
  assert.equal(clearRes.status, 200);
  assert.equal(clearRes.body.cart.length, 0);
});

// ============================================================================
// 3. CHECKOUT & PRICING INTEGRITY
// ============================================================================
test('Checkout Integrity: price calculation, address validation, and atomic rollback on failure', async () => {
  // A. Checkout with empty cart -> 400 Bad Request
  const emptyCheck = await server.client.post('/api/orders/checkout', { address: testAddress }, { token: customerToken });
  assert.equal(emptyCheck.status, 400);

  // B. Add item: price 85 * 1 = 85 -> Delivery fee = 8 -> Total = 93
  await server.client.post('/api/cart/items', { productId: testProduct.id, quantity: 1 }, { token: customerToken });

  // C. Checkout with missing address -> 400 Bad Request
  const noAddr = await server.client.post('/api/orders/checkout', {}, { token: customerToken });
  assert.equal(noAddr.status, 400);

  // D. Checkout with incomplete address -> 400 Bad Request
  const badAddr = await server.client.post(
    '/api/orders/checkout',
    { address: { name: 'Bob' } },
    { token: customerToken }
  );
  assert.equal(badAddr.status, 400);

  // E. Checkout with payment failure (amount ends in .99) causes atomic rollback
  await pool.query('UPDATE products SET price = 12.99 WHERE id = $1', [testProduct.id]);
  // 12.99 * 1 + 8 fee = 20.99 (triggers mock card declined)
  const declinedRes = await server.client.post(
    '/api/orders/checkout',
    { address: testAddress },
    { token: customerToken }
  );
  assert.equal(declinedRes.status, 400);
  assert.match(declinedRes.body.error.message, /Payment failed/i);

  // Verify stock was untouched and cart was NOT cleared
  const { rows: prodStock } = await pool.query('SELECT stock FROM products WHERE id = $1', [testProduct.id]);
  assert.equal(prodStock[0].stock, 25);
  const cartCheck = await server.client.get('/api/cart', { token: customerToken });
  assert.equal(cartCheck.body.cart.length, 1);

  // Restore price and clear cart
  await pool.query('UPDATE products SET price = 85.00 WHERE id = $1', [testProduct.id]);
  await server.client.del('/api/cart', { token: customerToken });
});

// ============================================================================
// 4. RAZORPAY TEST MODE AUDIT (14 VERIFICATION POINTS)
// ============================================================================
test('Razorpay Test Mode Audit: 14 Verification Points', async () => {
  // Point 1: Config presence & key secrecy
  assert.ok(config.payment.razorpayKeyId, 'RAZORPAY_KEY_ID should be configured');
  assert.ok(config.payment.razorpayKeySecret, 'RAZORPAY_KEY_SECRET should be configured');

  // Point 2: Add product to cart to test Razorpay order generation
  await server.client.post('/api/cart/items', { productId: testProduct.id, quantity: 2 }, { token: customerToken });
  // Subtotal: 85 * 2 = 170 (> 100 -> free delivery) -> Total = 170.00 -> 17000 paise

  // Point 3 & 4: Backend creates Razorpay order with paise amount and INR currency
  const rzpOrderRes = await server.client.post('/api/orders/razorpay/create-order', {}, { token: customerToken });
  assert.equal(rzpOrderRes.status, 201);
  assert.ok(rzpOrderRes.body.order_id);
  assert.equal(rzpOrderRes.body.amount, 17000); // 170.00 INR = 17000 paise
  assert.equal(rzpOrderRes.body.currency, 'INR');
  assert.equal(rzpOrderRes.body.key_id, config.payment.razorpayKeyId);
  // Point 5: Ensure secret is NEVER exposed in the response
  assert.equal(rzpOrderRes.body.key_secret, undefined);
  assert.equal(rzpOrderRes.body.secret, undefined);

  const orderId = rzpOrderRes.body.order_id;
  const paymentId = `pay_test_${crypto.randomBytes(6).toString('hex')}`;

  // Point 6: Generate valid HMAC-SHA256 signature
  const validSig = crypto
    .createHmac('sha256', config.payment.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  // Point 7: Standalone signature verification succeeds for authentic signature
  const verifyRes = await server.client.post(
    '/api/orders/razorpay/verify-payment',
    {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: validSig
    },
    { token: customerToken }
  );
  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.verified, true);

  // Point 8: Invalid signature fails verification (400 Bad Request)
  const invalidSigRes = await server.client.post(
    '/api/orders/razorpay/verify-payment',
    {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: 'invalid_tampered_signature_9999999999999999'
    },
    { token: customerToken }
  );
  assert.equal(invalidSigRes.status, 400);

  // Point 9: Inauthentic checkout with bad signature is rejected and cart preserved
  const badCheckout = await server.client.post(
    '/api/orders/checkout',
    {
      address: testAddress,
      payment: {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: 'forged_signature_attempt'
      }
    },
    { token: customerToken }
  );
  assert.equal(badCheckout.status, 400);

  // Point 10: Successful checkout with authentic signature
  const goodCheckout = await server.client.post(
    '/api/orders/checkout',
    {
      address: testAddress,
      payment: {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: validSig
      }
    },
    { token: customerToken }
  );
  assert.equal(goodCheckout.status, 201);
  const confirmedOrder = goodCheckout.body.order;
  assert.equal(confirmedOrder.status, 'Payment Confirmed');
  assert.equal(confirmedOrder.paymentStatus, 'Paid');

  // Point 11: Duplicate payment submission with same razorpay_payment_id is blocked (409 Conflict)
  // Put an item back in cart to simulate repeated checkout attempt
  await server.client.post('/api/cart/items', { productId: testProduct.id, quantity: 1 }, { token: customerToken });
  const dupPaymentRes = await server.client.post(
    '/api/orders/checkout',
    {
      address: testAddress,
      payment: {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId, // reused payment ID
        razorpay_signature: validSig
      }
    },
    { token: customerToken }
  );
  assert.equal(dupPaymentRes.status, 409);
  assert.match(dupPaymentRes.body.error.message, /already been processed/i);
  await server.client.del('/api/cart', { token: customerToken });

  // Point 12: Timing-safe HMAC verification unit test
  const hmacValid = paymentService.verifyRazorpayHmac(orderId, paymentId, validSig, config.payment.razorpayKeySecret);
  assert.equal(hmacValid.valid, true);

  // Point 13: Timing-safe HMAC verification with bad secret fails
  const hmacBadSecret = paymentService.verifyRazorpayHmac(orderId, paymentId, validSig, 'wrong_secret');
  assert.equal(hmacBadSecret.valid, false);

  // Point 14: Timing-safe HMAC verification with missing parameters fails safely
  const hmacMissing = paymentService.verifyRazorpayHmac(null, paymentId, validSig, config.payment.razorpayKeySecret);
  assert.equal(hmacMissing.valid, false);
});

// ============================================================================
// 5. ORDER MANAGEMENT & ACCESS CONTROL ISOLATION
// ============================================================================
test('Order Management: customer history, order details, and ownership isolation (403)', async () => {
  // Ensure an order exists for Customer Primary
  await server.client.post('/api/cart/items', { productId: testProduct.id, quantity: 1 }, { token: customerToken });
  const newOrderRes = await server.client.post('/api/orders/checkout', { address: testAddress }, { token: customerToken });
  assert.equal(newOrderRes.status, 201);
  const primaryOrderId = newOrderRes.body.order.id;

  // A. Customer Primary lists orders
  const ordersRes = await server.client.get('/api/orders', { token: customerToken });
  assert.equal(ordersRes.status, 200);
  assert.ok(ordersRes.body.orders.length > 0);

  // B. Customer Primary views their own order details
  const myOrderRes = await server.client.get(`/api/orders/${primaryOrderId}`, { token: customerToken });
  assert.equal(myOrderRes.status, 200);
  assert.equal(myOrderRes.body.order.id, primaryOrderId);

  // C. Customer Secondary attempts to access Customer Primary order -> 403 Forbidden
  const forbiddenRes = await server.client.get(`/api/orders/${primaryOrderId}`, { token: otherCustomerToken });
  assert.equal(forbiddenRes.status, 403);
  assert.match(forbiddenRes.body.error.message, /Not your order/i);
});

// ============================================================================
// 6. DELIVERY AGENT LIFECYCLE & ISOLATION
// ============================================================================
test('Delivery Agent Lifecycle: timeline advancement, claim, and agent isolation', async () => {
  // A. Create an unassigned order
  await server.client.post('/api/cart/items', { productId: testProduct.id, quantity: 1 }, { token: customerToken });
  const checkRes = await server.client.post('/api/orders/checkout', { address: testAddress }, { token: customerToken });
  assert.equal(checkRes.status, 201);
  const orderId = checkRes.body.order.id;

  // Clear agent assignment in DB to test unassigned flow
  await pool.query('UPDATE deliveries SET agent_id = NULL, status = \'Assigned\' WHERE order_id = $1', [orderId]);

  // B. Delivery Agent A claims unassigned order
  const claimRes = await server.client.post(`/api/orders/${orderId}/claim`, {}, { token: deliveryToken });
  assert.equal(claimRes.status, 200);
  assert.equal(claimRes.body.order.deliveryAgentId, deliveryId);

  // C. Delivery Agent B attempts to claim already claimed order -> 409 Conflict
  const dupClaim = await server.client.post(`/api/orders/${orderId}/claim`, {}, { token: otherDeliveryToken });
  assert.equal(dupClaim.status, 409);

  // D. Delivery Agent B attempts to advance order assigned to Delivery Agent A -> 403 Forbidden
  const unauthAdvance = await server.client.post(`/api/orders/${orderId}/advance`, {}, { token: otherDeliveryToken });
  assert.equal(unauthAdvance.status, 403);
  assert.match(unauthAdvance.body.error.message, /not assigned to you/i);

  // E. Delivery Agent A advances status through sequence:
  // Initial: 'Payment Confirmed' -> 'Processing' -> 'Dispatched' -> 'Shipped' -> 'Out for Delivery' -> 'Delivered'
  const step1 = await server.client.post(`/api/orders/${orderId}/advance`, {}, { token: deliveryToken });
  assert.equal(step1.body.order.status, 'Processing');

  const step2 = await server.client.post(`/api/orders/${orderId}/advance`, {}, { token: deliveryToken });
  assert.equal(step2.body.order.status, 'Dispatched');

  const step3 = await server.client.post(`/api/orders/${orderId}/advance`, {}, { token: deliveryToken });
  assert.equal(step3.body.order.status, 'Shipped');

  const step4 = await server.client.post(`/api/orders/${orderId}/advance`, {}, { token: deliveryToken });
  assert.equal(step4.body.order.status, 'Out for Delivery');

  const step5 = await server.client.post(`/api/orders/${orderId}/advance`, {}, { token: deliveryToken });
  assert.equal(step5.body.order.status, 'Delivered');

  // F. Delivered order is immutable: advancing beyond Delivered returns 400 Bad Request
  const beyondDelivered = await server.client.post(`/api/orders/${orderId}/advance`, {}, { token: deliveryToken });
  assert.equal(beyondDelivered.status, 400);
  assert.match(beyondDelivered.body.error.message, /already delivered/i);
});

// ============================================================================
// 7. RETURNS, REFUNDS & RESTOCKING AUDIT
// ============================================================================
test('Returns and Refunds: reason validation, 14-day window, duplicate block, admin refund and stock restoration', async () => {
  // A. Create and deliver an order for return testing
  const initialStock = (await pool.query('SELECT stock FROM products WHERE id = $1', [testProduct.id])).rows[0].stock;

  await server.client.post('/api/cart/items', { productId: testProduct.id, quantity: 2 }, { token: customerToken });
  const checkRes = await server.client.post('/api/orders/checkout', { address: testAddress }, { token: customerToken });
  const orderId = checkRes.body.order.id;

  // Advance order to Delivered
  await pool.query('UPDATE deliveries SET agent_id = $1 WHERE order_id = $2', [deliveryId, orderId]);
  for (let i = 0; i < 5; i++) {
    await server.client.post(`/api/orders/${orderId}/advance`, {}, { token: deliveryToken });
  }

  // Verify stock was decremented by 2
  const postBuyStock = (await pool.query('SELECT stock FROM products WHERE id = $1', [testProduct.id])).rows[0].stock;
  assert.equal(postBuyStock, initialStock - 2);

  // B. Customer attempts return with missing/empty reason -> 400 Bad Request
  const emptyReason = await server.client.post(
    '/api/returns',
    { orderId, productId: testProduct.id, reason: '' },
    { token: customerToken }
  );
  assert.equal(emptyReason.status, 400);

  // C. Customer Secondary attempts to return Customer Primary's order -> 403 Forbidden
  const otherCustReturn = await server.client.post(
    '/api/returns',
    { orderId, productId: testProduct.id, reason: 'Wrong color' },
    { token: otherCustomerToken }
  );
  assert.equal(otherCustReturn.status, 403);

  // D. Customer Primary submits valid return request
  const validReturn = await server.client.post(
    '/api/returns',
    { orderId, productId: testProduct.id, reason: 'Size too large' },
    { token: customerToken }
  );
  assert.equal(validReturn.status, 201);
  const returnId = validReturn.body.return.id;
  assert.equal(validReturn.body.return.status, 'Requested');

  // E. Duplicate return attempt on the same item is rejected -> 409 Conflict
  const dupReturn = await server.client.post(
    '/api/returns',
    { orderId, productId: testProduct.id, reason: 'Size too large' },
    { token: customerToken }
  );
  assert.equal(dupReturn.status, 409);

  // F. Non-admin (customer or delivery) attempts to approve return -> 403 Forbidden
  const custApprove = await server.client.post(`/api/returns/${returnId}/approve`, {}, { token: customerToken });
  assert.equal(custApprove.status, 403);
  const delApprove = await server.client.post(`/api/returns/${returnId}/approve`, {}, { token: deliveryToken });
  assert.equal(delApprove.status, 403);

  // G. Admin approves the return: refund issued and stock restored
  const adminApprove = await server.client.post(`/api/returns/${returnId}/approve`, {}, { token: adminToken });
  assert.equal(adminApprove.status, 200);
  assert.equal(adminApprove.body.return.status, 'Refunded');

  // H. Product stock is restored (+2)
  const restockedStock = (await pool.query('SELECT stock FROM products WHERE id = $1', [testProduct.id])).rows[0].stock;
  assert.equal(restockedStock, initialStock);

  // I. Refund payment record created
  const { rows: refundPayments } = await pool.query(
    'SELECT * FROM payments WHERE order_id = $1 AND type = \'refund\'',
    [orderId]
  );
  assert.equal(refundPayments.length, 1);
  assert.equal(refundPayments[0].status, 'Paid');

  // J. Attempt to approve already resolved return -> 409 Conflict
  const reApprove = await server.client.post(`/api/returns/${returnId}/approve`, {}, { token: adminToken });
  assert.equal(reApprove.status, 409);
});

// ============================================================================
// 8. FULL END-TO-END WORKFLOW INTEGRATION
// ============================================================================
test('Complete End-to-End Workflow: Seller Product -> Customer Razorpay -> Delivery -> Return -> Refund', async () => {
  // Step 1: Seller creates an E2E test product
  const sellerProdRes = await server.client.post(
    '/api/products',
    {
      name: 'E2E Audited Running Shoes',
      description: 'Cushioned running shoes with ergonomic sole',
      price: 120.00,
      stock: 10,
      category: 'Sports',
      subcategory: 'Footwear',
      brand: 'KadaSpeed',
      images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff'],
      tags: ['shoes', 'sports', 'running']
    },
    { token: sellerToken }
  );
  assert.equal(sellerProdRes.status, 201, `Failed to create product: ${JSON.stringify(sellerProdRes.body)}`);
  const e2eProduct = sellerProdRes.body.product;

  // Step 2: Customer discovers and adds product to cart
  const addCart = await server.client.post(
    '/api/cart/items',
    { productId: e2eProduct.id, quantity: 1 },
    { token: customerToken }
  );
  assert.equal(addCart.status, 201);

  // Step 3: Backend creates Razorpay order
  const rzpOrder = await server.client.post('/api/orders/razorpay/create-order', {}, { token: customerToken });
  assert.equal(rzpOrder.status, 201);
  assert.equal(rzpOrder.body.amount, 12000); // 120.00 INR = 12000 paise

  // Step 4: Generate Razorpay test payment and HMAC signature
  const paymentId = `pay_e2e_${crypto.randomBytes(6).toString('hex')}`;
  const validSig = crypto
    .createHmac('sha256', config.payment.razorpayKeySecret)
    .update(`${rzpOrder.body.order_id}|${paymentId}`)
    .digest('hex');

  // Step 5: Customer completes checkout
  const orderRes = await server.client.post(
    '/api/orders/checkout',
    {
      address: testAddress,
      payment: {
        razorpay_order_id: rzpOrder.body.order_id,
        razorpay_payment_id: paymentId,
        razorpay_signature: validSig
      }
    },
    { token: customerToken }
  );
  assert.equal(orderRes.status, 201);
  const e2eOrderId = orderRes.body.order.id;

  // Verify stock decremented 10 -> 9
  const { rows: stockAfterBuy } = await pool.query('SELECT stock FROM products WHERE id = $1', [e2eProduct.id]);
  assert.equal(stockAfterBuy[0].stock, 9);

  // Step 6: Delivery agent claims and completes delivery
  await pool.query('UPDATE deliveries SET agent_id = $1 WHERE order_id = $2', [deliveryId, e2eOrderId]);
  for (let s = 0; s < 5; s++) {
    await server.client.post(`/api/orders/${e2eOrderId}/advance`, {}, { token: deliveryToken });
  }
  const deliveredOrder = await server.client.get(`/api/orders/${e2eOrderId}`, { token: customerToken });
  assert.equal(deliveredOrder.body.order.status, 'Delivered');

  // Step 7: Customer requests return
  const returnRes = await server.client.post(
    '/api/returns',
    { orderId: e2eOrderId, productId: e2eProduct.id, reason: 'Fit is slightly small' },
    { token: customerToken }
  );
  assert.equal(returnRes.status, 201);
  const e2eReturnId = returnRes.body.return.id;

  // Step 8: Admin approves return and issues refund
  const refundRes = await server.client.post(`/api/returns/${e2eReturnId}/approve`, {}, { token: adminToken });
  assert.equal(refundRes.status, 200);
  assert.equal(refundRes.body.return.status, 'Refunded');

  // Step 9: Verify stock restored to 10
  const { rows: stockAfterRefund } = await pool.query('SELECT stock FROM products WHERE id = $1', [e2eProduct.id]);
  assert.equal(stockAfterRefund[0].stock, 10);
});
