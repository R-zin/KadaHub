const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, seedFixtures, closeDb } = require('./helpers');
const { pool } = require('../src/db');

let server;
let fixtures;
let adminToken;
let customerToken;
let customerId;
let sellerToken;
let sellerId;

const testAddress = {
  name: 'Sam Tester',
  phone: '555-9876',
  line1: '456 Admin Blvd',
  city: 'Capital City',
  region: 'CA',
  postalCode: '90001'
};

before(async () => {
  server = await startServer();
  fixtures = await seedFixtures();

  // Admin login
  const adminRes = await server.client.post('/api/auth/login', { email: 'admin@test.com', password: 'password123' });
  adminToken = adminRes.body.token;

  // Register Customer
  const custRes = await server.client.post('/api/auth/register', {
    name: 'Customer One',
    email: 'admin_cust1@test.com',
    password: 'password123'
  });
  customerToken = custRes.body.token;
  customerId = custRes.body.user.id;

  // Register Seller
  const sellerRes = await server.client.post('/api/auth/register', {
    name: 'Seller One',
    email: 'admin_seller1@test.com',
    password: 'password123',
    role: 'seller',
    storeName: 'Admin Store One'
  });
  sellerToken = sellerRes.body.token;
  sellerId = sellerRes.body.user.id;
});

after(async () => {
  await server.close();
  await closeDb();
});

test('1. Non-admin users are blocked from admin statistics and user management (RBAC 403)', async () => {
  const custStats = await server.client.get('/api/admin/stats', { token: customerToken });
  assert.equal(custStats.status, 403);

  const sellerUsers = await server.client.get('/api/admin/users', { token: sellerToken });
  assert.equal(sellerUsers.status, 403);

  const anonReports = await server.client.get('/api/admin/reports');
  assert.equal(anonReports.status, 401);
});

test('2. User deactivation decrements activeUsers count immediately, activation increments it', async () => {
  // Query initial stats
  const initialStats = (await server.client.get('/api/admin/stats', { token: adminToken })).body.stats;
  const initialActive = initialStats.activeUsers;
  const initialTotal = initialStats.totalUsers;

  // Deactivate Customer One
  const deactRes = await server.client.patch(`/api/admin/users/${customerId}/active`, { isActive: false }, { token: adminToken });
  assert.equal(deactRes.status, 200);
  assert.strictEqual(deactRes.body.user.isActive, false);

  // Check stats immediately reflect deactivation
  const afterDeact = (await server.client.get('/api/admin/stats', { token: adminToken })).body.stats;
  assert.equal(afterDeact.activeUsers, initialActive - 1);
  assert.equal(afterDeact.totalUsers, initialTotal); // total unchanged

  // Reactivate Customer One
  const actRes = await server.client.patch(`/api/admin/users/${customerId}/active`, { isActive: true }, { token: adminToken });
  assert.equal(actRes.status, 200);
  assert.strictEqual(actRes.body.user.isActive, true);

  // Check stats immediately reflect reactivation
  const afterAct = (await server.client.get('/api/admin/stats', { token: adminToken })).body.stats;
  assert.equal(afterAct.activeUsers, initialActive);
});

let testOrderId;
let initialRevenue;

test('3. Revenue and order count increase upon successful checkout', async () => {
  const statsBefore = (await server.client.get('/api/admin/stats', { token: adminToken })).body.stats;
  initialRevenue = statsBefore.totalRevenue;
  const initialOrders = statsBefore.totalOrders;

  // Set product price to 50.00, stock to 20
  await pool.query('UPDATE products SET price = 50.00, stock = 20 WHERE id = $1', [fixtures.productId]);

  // Customer places order for 2 units ($100 items + $8 delivery = $108)
  await server.client.post('/api/cart/items', { productId: fixtures.productId, quantity: 2 }, { token: customerToken });
  const checkoutRes = await server.client.post('/api/orders/checkout', { address: testAddress }, { token: customerToken });
  assert.equal(checkoutRes.status, 201);
  testOrderId = checkoutRes.body.order.id;

  const statsAfter = (await server.client.get('/api/admin/stats', { token: adminToken })).body.stats;
  assert.equal(statsAfter.totalRevenue, initialRevenue + 108);
  assert.equal(statsAfter.totalOrders, initialOrders + 1);
});

test('4. Revenue decreases accurately when a refund is approved', async () => {
  // Mark order delivered so return can be requested
  await pool.query("UPDATE orders SET status = 'Delivered' WHERE id = $1", [testOrderId]);
  await pool.query("UPDATE deliveries SET status = 'Delivered', delivered_at = now() WHERE order_id = $1", [testOrderId]);

  // Customer requests return for 1 unit ($50)
  // Wait, the order item has quantity 2 @ $50 each. Return request returns item quantity (2 units = $100).
  const retReq = await server.client.post('/api/returns', {
    orderId: testOrderId,
    productId: fixtures.productId,
    reason: 'Size issue'
  }, { token: customerToken });
  assert.equal(retReq.status, 201);
  const returnId = retReq.body.return.id;

  // Pending returns count incremented
  const statsWithReturn = (await server.client.get('/api/admin/stats', { token: adminToken })).body.stats;
  assert.equal(statsWithReturn.pendingReturns, 1);

  // Admin approves return -> refunds $100
  const approveRes = await server.client.post(`/api/returns/${returnId}/approve`, {}, { token: adminToken });
  assert.equal(approveRes.status, 200);

  // Net revenue should now be: initialRevenue + ($108 - $100) = initialRevenue + $8
  const statsAfterRefund = (await server.client.get('/api/admin/stats', { token: adminToken })).body.stats;
  assert.equal(statsAfterRefund.totalRevenue, initialRevenue + 8);
  assert.equal(statsAfterRefund.pendingReturns, 0);
});

test('5. Cancelled orders are excluded from revenue and active orders count', async () => {
  const statsBefore = (await server.client.get('/api/admin/stats', { token: adminToken })).body.stats;

  // Place another order ($50 * 1 + $8 fee = $58)
  await server.client.post('/api/cart/items', { productId: fixtures.productId, quantity: 1 }, { token: customerToken });
  const co = await server.client.post('/api/orders/checkout', { address: testAddress }, { token: customerToken });
  const cancelledOrderId = co.body.order.id;

  // Verify revenue includes this $58
  const statsWithNewOrder = (await server.client.get('/api/admin/stats', { token: adminToken })).body.stats;
  assert.equal(statsWithNewOrder.totalRevenue, statsBefore.totalRevenue + 58);
  assert.equal(statsWithNewOrder.totalOrders, statsBefore.totalOrders + 1);

  // Cancel this order
  await pool.query("UPDATE orders SET status = 'Cancelled' WHERE id = $1", [cancelledOrderId]);

  // Verify revenue and orders exclude the cancelled order
  const statsAfterCancel = (await server.client.get('/api/admin/stats', { token: adminToken })).body.stats;
  assert.equal(statsAfterCancel.totalRevenue, statsBefore.totalRevenue);
  assert.equal(statsAfterCancel.totalOrders, statsBefore.totalOrders);
});

test('6. Products catalog accessibility: all products accessible beyond 50', async () => {
  // Check how many products exist
  const countBefore = (await pool.query('SELECT COUNT(*) FROM products')).rows[0].count;

  // Insert additional products so total exceeds 55
  const needed = Math.max(0, 60 - Number(countBefore));
  for (let i = 1; i <= needed; i++) {
    await pool.query(
      `INSERT INTO products (seller_id, category_id, subcategory, name, price, stock)
       VALUES ($1, $2, 'T-Shirts', $3, 29.99, 15)`,
      [fixtures.sellerId, fixtures.categoryId, `Bulk Product Item #${i}`]
    );
  }

  // Admin stats products reflects full count
  const stats = (await server.client.get('/api/admin/stats', { token: adminToken })).body.stats;
  assert.ok(stats.products >= 60);

  // Product listing endpoint returns all products (no 50-item cap)
  const prodList = await server.client.get('/api/products');
  assert.equal(prodList.status, 200);
  assert.ok(prodList.body.products.length >= 60, `Expected at least 60 products, got ${prodList.body.products.length}`);
});

test('7. Transactions endpoint returns charges and refunds with full metadata', async () => {
  const txRes = await server.client.get('/api/admin/transactions', { token: adminToken });
  assert.equal(txRes.status, 200);
  const txs = txRes.body.transactions;
  assert.ok(txs.length >= 2);

  const chargeTx = txs.find((t) => t.type === 'charge' && t.orderId === String(testOrderId));
  assert.ok(chargeTx);
  assert.equal(chargeTx.status, 'Paid');
  assert.equal(chargeTx.amount, 108);

  const refundTx = txs.find((t) => t.type === 'refund' && t.orderId === String(testOrderId));
  assert.ok(refundTx);
  assert.equal(refundTx.status, 'Paid');
  assert.equal(refundTx.amount, 100);
});

test('8. Reports endpoint returns accurate daily sales and category inventory distribution', async () => {
  const repRes = await server.client.get('/api/admin/reports', { token: adminToken });
  assert.equal(repRes.status, 200);
  const { salesByDay, inventoryByCategory } = repRes.body;

  assert.ok(Array.isArray(salesByDay));
  assert.ok(Array.isArray(inventoryByCategory));
  assert.ok(inventoryByCategory.length > 0);

  const clothingCat = inventoryByCategory.find((c) => c.category === 'Clothing');
  assert.ok(clothingCat);
  assert.ok(clothingCat.products > 0);
  assert.ok(clothingCat.stock > 0);
});
