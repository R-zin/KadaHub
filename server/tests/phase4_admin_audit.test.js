const { test, before, after } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const { startServer, seedFixtures, closeDb } = require('./helpers');
const { pool, query } = require('../src/db');
const { JWT_SECRET } = require('../src/config');

let server;
let fixtures;
let adminToken;
let adminId;
let customerToken;
let customerId;
let sellerToken;
let sellerId;
let deliveryToken;
let deliveryId;

const testAddress = {
  name: 'Phase4 Auditor',
  phone: '555-0199',
  line1: '100 Audit Plaza',
  city: 'Audit City',
  region: 'KA',
  postalCode: '560001'
};

before(async () => {
  server = await startServer();
  fixtures = await seedFixtures();

  // 1. Admin Login
  const adminRes = await server.client.post('/api/auth/login', {
    email: 'admin@test.com',
    password: 'password123'
  });
  assert.equal(adminRes.status, 200);
  adminToken = adminRes.body.token;
  adminId = adminRes.body.user.id;

  // 2. Customer
  const custRes = await server.client.post('/api/auth/register', {
    name: 'P4 Customer',
    email: 'p4_customer@test.com',
    password: 'password123'
  });
  assert.equal(custRes.status, 201);
  customerToken = custRes.body.token;
  customerId = custRes.body.user.id;

  // 3. Seller
  const sellerRes = await server.client.post('/api/auth/register', {
    name: 'P4 Seller',
    email: 'p4_seller@test.com',
    password: 'password123',
    role: 'seller',
    storeName: 'P4 Store'
  });
  assert.equal(sellerRes.status, 201);
  sellerToken = sellerRes.body.token;
  sellerId = sellerRes.body.user.id;

  // 4. Delivery Agent (from fixtures)
  const delivRes = await server.client.post('/api/auth/login', {
    email: 'delivery@test.com',
    password: 'password123'
  });
  assert.equal(delivRes.status, 200);
  deliveryToken = delivRes.body.token;
  deliveryId = delivRes.body.user.id;
});

after(async () => {
  await server.close();
  await closeDb();
});

// ============================================================================
// 1. ADMIN ACCESS & RBAC SECURITY
// ============================================================================

test('1.1 Admin access: Only authorized administrators can access /api/admin/*', async () => {
  // Admin succeeds
  const adminStats = await server.client.get('/api/admin/stats', { token: adminToken });
  assert.equal(adminStats.status, 200);
  assert.ok(adminStats.body.stats);

  // Unauthenticated gets 401
  const anonStats = await server.client.get('/api/admin/stats');
  assert.equal(anonStats.status, 401);

  // Customer gets 403 Forbidden
  const custStats = await server.client.get('/api/admin/stats', { token: customerToken });
  assert.equal(custStats.status, 403);

  // Seller gets 403 Forbidden
  const sellerUsers = await server.client.get('/api/admin/users', { token: sellerToken });
  assert.equal(sellerUsers.status, 403);

  // Delivery agent gets 403 Forbidden
  const delivReports = await server.client.get('/api/admin/reports', { token: deliveryToken });
  assert.equal(delivReports.status, 403);
});

test('1.2 Admin access: Tampered JWT token and forged admin role claims are rejected (401)', async () => {
  // Tampered signature
  const tamperedToken = adminToken.slice(0, -5) + 'xxxxx';
  const resTampered = await server.client.get('/api/admin/stats', { token: tamperedToken });
  assert.equal(resTampered.status, 401);

  // Forged JWT signed with wrong key
  const forgedToken = jwt.sign(
    { id: customerId, role: 'admin', email: 'p4_customer@test.com' },
    'wrong-secret-key-12345',
    { expiresIn: '1h' }
  );
  const resForged = await server.client.get('/api/admin/stats', { token: forgedToken });
  assert.equal(resForged.status, 401);
});

// ============================================================================
// 2. USER MANAGEMENT
// ============================================================================

test('2.1 User management: Admin can list users and view roles', async () => {
  const res = await server.client.get('/api/admin/users', { token: adminToken });
  assert.equal(res.status, 200);
  const users = res.body.users;
  assert.ok(Array.isArray(users));

  const foundCustomer = users.find((u) => u.id === customerId);
  assert.ok(foundCustomer);
  assert.equal(foundCustomer.role, 'customer');

  const foundSeller = users.find((u) => u.id === sellerId);
  assert.ok(foundSeller);
  assert.equal(foundSeller.role, 'seller');

  const foundDelivery = users.find((u) => u.id === deliveryId);
  assert.ok(foundDelivery);
  assert.equal(foundDelivery.role, 'delivery');
});

test('2.2 User management: Admin can activate and deactivate users', async () => {
  try {
    // Deactivate customer
    const deactRes = await server.client.patch(`/api/admin/users/${customerId}/active`, { isActive: false }, { token: adminToken });
    assert.equal(deactRes.status, 200);
    assert.equal(deactRes.body.user.isActive, false);

    // Deactivated user cannot log in (403 Forbidden)
    const loginRes = await server.client.post('/api/auth/login', { email: 'p4_customer@test.com', password: 'password123' });
    assert.equal(loginRes.status, 403);
    assert.match(loginRes.body.error.message, /deactivated/i);

    // Reactivate customer
    const actRes = await server.client.patch(`/api/admin/users/${customerId}/active`, { isActive: true }, { token: adminToken });
    assert.equal(actRes.status, 200);
    assert.equal(actRes.body.user.isActive, true);

    // Reactivated user can log in again
    const loginRes2 = await server.client.post('/api/auth/login', { email: 'p4_customer@test.com', password: 'password123' });
    assert.equal(loginRes2.status, 200);
  } finally {
    await server.client.patch(`/api/admin/users/${customerId}/active`, { isActive: true }, { token: adminToken });
  }
});

test('2.3 User management: Admin cannot deactivate own account (Self-lockout guard)', async () => {
  const selfDeact = await server.client.patch(`/api/admin/users/${adminId}/active`, { isActive: false }, { token: adminToken });
  assert.equal(selfDeact.status, 400);
  assert.match(selfDeact.body.error.message, /cannot deactivate your own.*account/i);
});

test('2.4 User management: Admin can change user roles via PATCH /api/admin/users/:id/role', async () => {
  // Promote customer to seller
  const roleRes = await server.client.patch(`/api/admin/users/${customerId}/role`, { role: 'seller' }, { token: adminToken });
  assert.equal(roleRes.status, 200);
  assert.equal(roleRes.body.user.role, 'seller');

  // Change back to customer
  const revertRes = await server.client.patch(`/api/admin/users/${customerId}/role`, { role: 'customer' }, { token: adminToken });
  assert.equal(revertRes.status, 200);
  assert.equal(revertRes.body.user.role, 'customer');

  // Invalid role rejected (400)
  const invalidRole = await server.client.patch(`/api/admin/users/${customerId}/role`, { role: 'supergod' }, { token: adminToken });
  assert.equal(invalidRole.status, 400);
});

// ============================================================================
// 3. PRODUCT MANAGEMENT
// ============================================================================

let testProductId;

test('3.1 Product management: Admin can update details and stock on any seller product', async () => {
  // Seller creates a product
  const createRes = await server.client.post('/api/products', {
    name: 'Audit Managed T-Shirt',
    description: 'A shirt for admin audit',
    price: 35.00,
    stock: 25,
    category: 'Clothing',
    subcategory: 'T-Shirts',
    brand: 'AuditBrand'
  }, { token: sellerToken });
  assert.equal(createRes.status, 201);
  testProductId = createRes.body.product.id;

  // Admin updates stock to 50
  const stockRes = await server.client.patch(`/api/products/${testProductId}/stock`, { stock: 50 }, { token: adminToken });
  assert.equal(stockRes.status, 200);
  assert.equal(stockRes.body.product.stock, 50);

  // Admin updates details (price, description)
  const updateRes = await server.client.put(`/api/products/${testProductId}`, {
    name: 'Audit Managed T-Shirt (Updated)',
    price: 42.00,
    description: 'Updated by admin'
  }, { token: adminToken });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.product.name, 'Audit Managed T-Shirt (Updated)');
  assert.equal(updateRes.body.product.price, 42.00);

  // Customer cannot update seller product (403)
  const custUpdate = await server.client.patch(`/api/products/${testProductId}/stock`, { stock: 10 }, { token: customerToken });
  assert.equal(custUpdate.status, 403);
});

test('3.2 Product management: Deleting product with order history is blocked', async () => {
  // Customer buys 1 unit of testProductId
  await server.client.post('/api/cart/items', { productId: testProductId, quantity: 1 }, { token: customerToken });
  const checkoutRes = await server.client.post('/api/orders/checkout', { address: testAddress }, { token: customerToken });
  assert.equal(checkoutRes.status, 201);

  // Attempt delete product with order history -> 400
  const delRes = await server.client.del(`/api/products/${testProductId}`, { token: adminToken });
  assert.equal(delRes.status, 400);
  assert.match(delRes.body.error.message, /existing order history/i);
});

// ============================================================================
// 4. ORDER MANAGEMENT
// ============================================================================

test('4.1 Order management: Admin sees all orders with customer details and accurate totals', async () => {
  const ordersRes = await server.client.get('/api/orders', { token: adminToken });
  assert.equal(ordersRes.status, 200);
  const orders = ordersRes.body.orders;
  assert.ok(Array.isArray(orders));
  assert.ok(orders.length > 0);

  const testOrder = orders.find((o) => o.customerId === customerId);
  assert.ok(testOrder, 'Admin should see customer order');
  assert.ok(testOrder.customerName, 'Order must include customerName');
  assert.ok(testOrder.customerEmail, 'Order must include customerEmail for admin');
  assert.ok(testOrder.items.length > 0, 'Order must include items');
  assert.ok(testOrder.total > 0, 'Order total must be positive');
  assert.ok(['Paid', 'Pending', 'Refunded', 'Failed'].includes(testOrder.paymentStatus));

  // Verify against DB record
  const { rows } = await query('SELECT * FROM orders WHERE id = $1', [Number(testOrder.id)]);
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].total), testOrder.total);
  assert.equal(rows[0].status, testOrder.status);
});

// ============================================================================
// 5. RETURN AND REFUND MANAGEMENT
// ============================================================================

let returnOrderId;
let returnItemId;
let createdReturnId;

test('5.1 Return management: Admin approves return, triggers refund, and restocks item', async () => {
  // Create a clean product with stock 10
  const prodRes = await server.client.post('/api/products', {
    name: 'Returnable Item',
    price: 40.00,
    stock: 10,
    category: 'Clothing',
    subcategory: 'T-Shirts'
  }, { token: sellerToken });
  returnItemId = prodRes.body.product.id;

  // Buy 2 units (stock becomes 8)
  await server.client.post('/api/cart/items', { productId: returnItemId, quantity: 2 }, { token: customerToken });
  const checkoutRes = await server.client.post('/api/orders/checkout', { address: testAddress }, { token: customerToken });
  assert.equal(checkoutRes.status, 201);
  returnOrderId = checkoutRes.body.order.id;

  // Stock is now 8
  const { rows: prodRow1 } = await query('SELECT stock FROM products WHERE id = $1', [returnItemId]);
  assert.equal(prodRow1[0].stock, 8);

  // Deliver order
  await query("UPDATE orders SET status = 'Delivered' WHERE id = $1", [returnOrderId]);
  await query("UPDATE deliveries SET status = 'Delivered', delivered_at = now() WHERE order_id = $1", [returnOrderId]);

  // Customer requests return
  const retReq = await server.client.post('/api/returns', {
    orderId: returnOrderId,
    productId: returnItemId,
    reason: 'Wrong size delivered'
  }, { token: customerToken });
  assert.equal(retReq.status, 201);
  createdReturnId = retReq.body.return.id;

  // Admin lists pending returns
  const returnsList = await server.client.get('/api/returns', { token: adminToken });
  assert.equal(returnsList.status, 200);
  const found = returnsList.body.returns.find((r) => r.id === createdReturnId);
  assert.ok(found);
  assert.equal(found.status, 'Requested');

  // Admin approves return
  const approveRes = await server.client.post(`/api/returns/${createdReturnId}/approve`, {}, { token: adminToken });
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.return.status, 'Refunded');

  // Stock should be restored from 8 back to 10
  const { rows: prodRow2 } = await query('SELECT stock FROM products WHERE id = $1', [returnItemId]);
  assert.equal(prodRow2[0].stock, 10);

  // Payment table should contain a refund record
  const { rows: refundRows } = await query("SELECT * FROM payments WHERE order_id = $1 AND type = 'refund'", [returnOrderId]);
  assert.equal(refundRows.length, 1);
  assert.equal(refundRows[0].status, 'Paid');
  assert.equal(Number(refundRows[0].amount), 80.00); // 2 units * $40.00 = $80.00
});

test('5.2 Return management: Duplicate approve/reject actions are rejected (409 Conflict)', async () => {
  // Attempt to approve again
  const dupApprove = await server.client.post(`/api/returns/${createdReturnId}/approve`, {}, { token: adminToken });
  assert.equal(dupApprove.status, 409);

  // Attempt to reject already refunded return
  const dupReject = await server.client.post(`/api/returns/${createdReturnId}/reject`, {}, { token: adminToken });
  assert.equal(dupReject.status, 409);
});

test('5.3 Return management: Non-existent return ID returns 404 Not Found', async () => {
  const notFoundApprove = await server.client.post('/api/returns/999999/approve', {}, { token: adminToken });
  assert.equal(notFoundApprove.status, 404);

  const notFoundReject = await server.client.post('/api/returns/999999/reject', {}, { token: adminToken });
  assert.equal(notFoundReject.status, 404);
});

// ============================================================================
// 6. DASHBOARD STATISTICS EXACT DATABASE MATCH
// ============================================================================

test('6.1 Dashboard statistics: Every metric strictly matches live database calculations', async () => {
  const statsRes = await server.client.get('/api/admin/stats', { token: adminToken });
  assert.equal(statsRes.status, 200);
  const stats = statsRes.body.stats;

  // 1. Total users & roles
  const { rows: userCounts } = await query(`
    SELECT
      COUNT(*) AS total_users,
      COUNT(*) FILTER (WHERE is_active = TRUE) AS active_users,
      COUNT(*) FILTER (WHERE role = 'customer') AS customers,
      COUNT(*) FILTER (WHERE role = 'seller') AS sellers,
      COUNT(*) FILTER (WHERE role = 'delivery') AS delivery_agents,
      COUNT(*) FILTER (WHERE role = 'admin') AS admins
    FROM users
  `);
  const uc = userCounts[0];
  assert.equal(stats.totalUsers, Number(uc.total_users));
  assert.equal(stats.activeUsers, Number(uc.active_users));
  assert.equal(stats.customers, Number(uc.customers));
  assert.equal(stats.sellers, Number(uc.sellers));
  assert.equal(stats.deliveryAgents, Number(uc.delivery_agents));
  assert.equal(stats.admins, Number(uc.admins));

  // 2. Catalog Products
  const { rows: prodCounts } = await query(`
    SELECT
      COUNT(*) AS products,
      COUNT(*) FILTER (WHERE stock > 0 AND stock <= 20) AS low_stock,
      COUNT(*) FILTER (WHERE stock = 0) AS out_of_stock
    FROM products
  `);
  const pc = prodCounts[0];
  assert.equal(stats.products, Number(pc.products));
  assert.equal(stats.lowStock, Number(pc.low_stock));
  assert.equal(stats.outOfStock, Number(pc.out_of_stock));

  // 3. Orders & Revenue
  const { rows: orderCounts } = await query("SELECT COUNT(*) AS total_orders FROM orders WHERE status <> 'Cancelled'");
  assert.equal(stats.totalOrders, Number(orderCounts[0].total_orders));

  const { rows: revCounts } = await query(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'charge' AND status = 'Paid' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN type = 'refund' AND status = 'Paid' THEN amount ELSE 0 END), 0) AS net_revenue
    FROM payments
    WHERE order_id IN (SELECT id FROM orders WHERE status <> 'Cancelled')
  `);
  assert.equal(stats.totalRevenue, Number(revCounts[0].net_revenue));

  // 4. Returns & Refunds
  const { rows: retCounts } = await query(`
    SELECT
      COUNT(*) AS total_returns,
      COUNT(*) FILTER (WHERE status = 'Requested') AS pending_returns
    FROM returns
  `);
  assert.equal(stats.totalReturns, Number(retCounts[0].total_returns));
  assert.equal(stats.pendingReturns, Number(retCounts[0].pending_returns));

  const { rows: refCounts } = await query(`
    SELECT
      COUNT(*) AS refunds,
      COALESCE(SUM(amount), 0) AS refunded_amount
    FROM payments
    WHERE type = 'refund' AND status = 'Paid'
  `);
  assert.equal(stats.refunds, Number(refCounts[0].refunds));
  assert.equal(stats.refundedAmount, Number(refCounts[0].refunded_amount));
});

// ============================================================================
// 7. REPORTS & ANALYTICS
// ============================================================================

test('7.1 Reports: Handles date filtering, days parameter, and custom range', async () => {
  // Preset days=30
  const res30 = await server.client.get('/api/admin/reports?days=30', { token: adminToken });
  assert.equal(res30.status, 200);
  assert.ok(Array.isArray(res30.body.salesByDay));
  assert.ok(Array.isArray(res30.body.inventoryByCategory));

  // Custom range with today
  const today = new Date().toISOString().slice(0, 10);
  const resCustom = await server.client.get(`/api/admin/reports?startDate=2020-01-01&endDate=${today}`, { token: adminToken });
  assert.equal(resCustom.status, 200);
  assert.ok(Array.isArray(resCustom.body.salesByDay));
});

test('7.2 Reports: Invalid date formats and inverted date ranges return 400 Bad Request', async () => {
  // Invalid format
  const badDate = await server.client.get('/api/admin/reports?startDate=not-a-date', { token: adminToken });
  assert.equal(badDate.status, 400);

  // Inverted range (startDate > endDate)
  const inverted = await server.client.get('/api/admin/reports?startDate=2026-12-31&endDate=2026-01-01', { token: adminToken });
  assert.equal(inverted.status, 400);
  assert.match(inverted.body.error.message, /startDate must be before or equal to endDate/i);
});

test('7.3 Reports: Handles empty sales results gracefully without errors', async () => {
  // Far future dates with 0 sales
  const emptyRes = await server.client.get('/api/admin/reports?startDate=2099-01-01&endDate=2099-01-31', { token: adminToken });
  assert.equal(emptyRes.status, 200);
  assert.deepEqual(emptyRes.body.salesByDay, []);
  assert.ok(emptyRes.body.inventoryByCategory.length > 0);
});

// ============================================================================
// 8. DATABASE CONSISTENCY & REFERENTIAL INTEGRITY
// ============================================================================

test('8.1 Database consistency: Zero orphan records across all entity relationships', async () => {
  const consistencyChecks = [
    { name: 'orders with non-existent customer', sql: 'SELECT count(*) FROM orders o LEFT JOIN users u ON u.id = o.customer_id WHERE u.id IS NULL' },
    { name: 'order_items with non-existent order', sql: 'SELECT count(*) FROM order_items oi LEFT JOIN orders o ON o.id = oi.order_id WHERE o.id IS NULL' },
    { name: 'order_items with non-existent product', sql: 'SELECT count(*) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE p.id IS NULL' },
    { name: 'payments with non-existent order', sql: 'SELECT count(*) FROM payments p LEFT JOIN orders o ON o.id = p.order_id WHERE o.id IS NULL' },
    { name: 'deliveries with non-existent order', sql: 'SELECT count(*) FROM deliveries d LEFT JOIN orders o ON o.id = d.order_id WHERE o.id IS NULL' },
    { name: 'returns with non-existent order', sql: 'SELECT count(*) FROM returns r LEFT JOIN orders o ON o.id = r.order_id WHERE o.id IS NULL' },
    { name: 'returns with non-existent product', sql: 'SELECT count(*) FROM returns r LEFT JOIN products p ON p.id = r.product_id WHERE p.id IS NULL' },
    { name: 'returns with non-existent customer', sql: 'SELECT count(*) FROM returns r LEFT JOIN users u ON u.id = r.customer_id WHERE u.id IS NULL' },
    { name: 'products with non-existent seller', sql: 'SELECT count(*) FROM products p LEFT JOIN users u ON u.id = p.seller_id WHERE u.id IS NULL' },
    { name: 'products with non-existent category', sql: 'SELECT count(*) FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE c.id IS NULL' },
    { name: 'product_images with non-existent product', sql: 'SELECT count(*) FROM product_images pi LEFT JOIN products p ON p.id = pi.product_id WHERE p.id IS NULL' }
  ];

  for (const c of consistencyChecks) {
    const { rows } = await query(c.sql);
    assert.equal(Number(rows[0].count), 0, `Detected orphan records in check: ${c.name}`);
  }
});
