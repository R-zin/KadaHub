const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, seedFixtures, closeDb } = require('./helpers');
const { pool } = require('../src/db');

let server;
let fixtures;
let custAToken;
let custAId;
let custBToken;
let custBId;
let delAToken;
let delAId;
let delBToken;
let delBId;
let adminToken;

const testAddress = {
  name: 'Jane Doe',
  phone: '555-1234',
  line1: '123 Market St',
  city: 'Metropolis',
  region: 'NY',
  postalCode: '10001'
};

before(async () => {
  server = await startServer();
  fixtures = await seedFixtures();

  // Admin login
  const adminRes = await server.client.post('/api/auth/login', { email: 'admin@test.com', password: 'password123' });
  adminToken = adminRes.body.token;

  // Delivery Agent A login
  const delARes = await server.client.post('/api/auth/login', { email: 'delivery@test.com', password: 'password123' });
  delAToken = delARes.body.token;
  delAId = delARes.body.user.id;

  // Admin provisions Delivery Agent B
  const delBRes = await server.client.post('/api/admin/users', {
    name: 'Delivery Agent B',
    email: 'deliveryb@test.com',
    password: 'password123',
    role: 'delivery'
  }, { token: adminToken });
  delBId = delBRes.body.user.id;
  const delBLogin = await server.client.post('/api/auth/login', { email: 'deliveryb@test.com', password: 'password123' });
  delBToken = delBLogin.body.token;

  // Register Customer A
  const custARes = await server.client.post('/api/auth/register', {
    name: 'Customer A',
    email: 'custA@test.com',
    password: 'password123'
  });
  custAToken = custARes.body.token;
  custAId = custARes.body.user.id;

  // Register Customer B
  const custBRes = await server.client.post('/api/auth/register', {
    name: 'Customer B',
    email: 'custB@test.com',
    password: 'password123'
  });
  custBToken = custBRes.body.token;
  custBId = custBRes.body.user.id;
});

after(async () => {
  await server.close();
  await closeDb();
});

test('1. Stock validation prevents overselling with human-readable message', async () => {
  await pool.query('UPDATE products SET stock = 10 WHERE id = $1', [fixtures.productId]);
  await server.client.del('/api/cart', { token: custAToken });
  await server.client.post('/api/cart/items', { productId: fixtures.productId, quantity: 2 }, { token: custAToken });
  // Simulate race condition: stock drops to 1 before checkout is confirmed
  await pool.query('UPDATE products SET stock = 1 WHERE id = $1', [fixtures.productId]);

  const res = await server.client.post('/api/orders/checkout', { address: testAddress }, { token: custAToken });
  assert.equal(res.status, 409);
  assert.match(res.body.error.message, /is no longer available in the requested quantity/i);
});

test('2. Payment failure rolls back checkout, preserves cart and inventory', async () => {
  // Amount ending in .99 triggers payment decline: price 12.99 * 1 + 8 fee = 20.99
  await pool.query('UPDATE products SET price = 12.99, stock = 10 WHERE id = $1', [fixtures.productId]);
  await server.client.del('/api/cart', { token: custAToken });
  await server.client.post('/api/cart/items', { productId: fixtures.productId, quantity: 1 }, { token: custAToken });

  const res = await server.client.post('/api/orders/checkout', { address: testAddress }, { token: custAToken });
  assert.equal(res.status, 400);
  assert.match(res.body.error.message, /Payment failed/i);
  assert.match(res.body.error.message, /Your cart and inventory have not been changed/i);

  // Verify cart retained item
  const cartRes = await server.client.get('/api/cart', { token: custAToken });
  assert.equal(cartRes.body.cart.length, 1);
  assert.equal(cartRes.body.cart[0].product.id, String(fixtures.productId));

  // Verify stock unchanged
  const { rows: prodRows } = await pool.query('SELECT stock FROM products WHERE id = $1', [fixtures.productId]);
  assert.equal(prodRows[0].stock, 10);
});

let deliveredOrderId;

test('3. Successful checkout decrements stock, clears cart, and assigns delivery', async () => {
  await pool.query('UPDATE products SET price = 50.00, stock = 10 WHERE id = $1', [fixtures.productId]);
  await server.client.del('/api/cart', { token: custAToken });
  await server.client.post('/api/cart/items', { productId: fixtures.productId, quantity: 2 }, { token: custAToken });

  const checkoutRes = await server.client.post('/api/orders/checkout', { address: testAddress }, { token: custAToken });
  assert.equal(checkoutRes.status, 201);
  const order = checkoutRes.body.order;
  deliveredOrderId = order.id;

  assert.equal(order.status, 'Payment Confirmed');
  assert.equal(order.paymentStatus, 'Paid');
  assert.equal(order.subtotal, 100);
  assert.equal(order.deliveryFee, 8);
  assert.equal(order.total, 108);

  // Stock decremented 10 -> 8
  const { rows: prodRows } = await pool.query('SELECT stock FROM products WHERE id = $1', [fixtures.productId]);
  assert.equal(prodRows[0].stock, 8);

  // Cart empty
  const cartRes = await server.client.get('/api/cart', { token: custAToken });
  assert.equal(cartRes.body.cart.length, 0);

  // Delivery agent assigned
  assert.ok(order.deliveryAgentId);
});

test('4. Order status progression and Delivery Agent isolation guards', async () => {
  // Check which agent was assigned
  const { rows: delRows } = await pool.query('SELECT agent_id FROM deliveries WHERE order_id = $1', [deliveredOrderId]);
  const assignedAgentId = delRows[0].agent_id;
  const assignedToken = assignedAgentId === delAId ? delAToken : delBToken;
  const unassignedToken = assignedAgentId === delAId ? delBToken : delAToken;

  // Unassigned delivery agent attempts to advance status -> 403 Forbidden
  const unauthorizedAdv = await server.client.post(`/api/orders/${deliveredOrderId}/advance`, {}, { token: unassignedToken });
  assert.equal(unauthorizedAdv.status, 403);
  assert.match(unauthorizedAdv.body.error.message, /not assigned to you/i);

  // Valid status progression: Payment Confirmed -> Processing -> Dispatched -> Shipped -> Out for Delivery -> Delivered
  const statuses = ['Processing', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered'];
  for (const expectedStatus of statuses) {
    const advRes = await server.client.post(`/api/orders/${deliveredOrderId}/advance`, {}, { token: assignedToken });
    assert.equal(advRes.status, 200);
    assert.equal(advRes.body.order.status, expectedStatus);
  }

  // Delivery record should now have delivered_at timestamp set
  const { rows: completedDel } = await pool.query('SELECT delivered_at, status FROM deliveries WHERE order_id = $1', [deliveredOrderId]);
  assert.equal(completedDel[0].status, 'Delivered');
  assert.ok(completedDel[0].delivered_at);
});

test('5. Delivered orders are immutable and reject further progression', async () => {
  const { rows: delRows } = await pool.query('SELECT agent_id FROM deliveries WHERE order_id = $1', [deliveredOrderId]);
  const assignedToken = delRows[0].agent_id === delAId ? delAToken : delBToken;

  const res = await server.client.post(`/api/orders/${deliveredOrderId}/advance`, {}, { token: assignedToken });
  assert.equal(res.status, 400);
  assert.match(res.body.error.message, /already delivered and cannot be changed/i);
});

let unassignedOrderId;

test('6. Unassigned order handling and Delivery Agent Claim mechanism', async () => {
  // Deactivate all delivery agents to simulate order placed when no delivery agents are active
  await pool.query("UPDATE users SET is_active = false WHERE role = 'delivery'");

  await server.client.post('/api/cart/items', { productId: fixtures.productId, quantity: 1 }, { token: custAToken });
  const checkoutRes = await server.client.post('/api/orders/checkout', { address: testAddress }, { token: custAToken });
  assert.equal(checkoutRes.status, 201);
  unassignedOrderId = checkoutRes.body.order.id;

  // Verify delivery record has agent_id IS NULL
  const { rows: delRows } = await pool.query('SELECT agent_id FROM deliveries WHERE order_id = $1', [unassignedOrderId]);
  assert.strictEqual(delRows[0].agent_id, null);

  // Reactivate delivery agents
  await pool.query("UPDATE users SET is_active = true WHERE role = 'delivery'");

  // Delivery agents can list unassigned orders
  const unassignedList = await server.client.get('/api/orders?unassigned=true', { token: delAToken });
  assert.equal(unassignedList.status, 200);
  const found = unassignedList.body.orders.find((o) => o.id === String(unassignedOrderId));
  assert.ok(found);

  // Delivery Agent A claims the order
  const claimRes = await server.client.post(`/api/orders/${unassignedOrderId}/claim`, {}, { token: delAToken });
  assert.equal(claimRes.status, 200);
  assert.equal(claimRes.body.order.deliveryAgentId, String(delAId));

  // Delivery Agent B attempts to claim already assigned order -> 409 Conflict
  const claimConflict = await server.client.post(`/api/orders/${unassignedOrderId}/claim`, {}, { token: delBToken });
  assert.equal(claimConflict.status, 409);
  assert.match(claimConflict.body.error.message, /already been assigned/i);
});

test('7. Admin can assign delivery agent to an order', async () => {
  // Reset agent_id to null for test
  await pool.query('UPDATE deliveries SET agent_id = NULL WHERE order_id = $1', [unassignedOrderId]);

  // Non-admin attempts to assign -> 403 Forbidden
  const forbidRes = await server.client.post(`/api/orders/${unassignedOrderId}/assign`, { agentId: delBId }, { token: custAToken });
  assert.equal(forbidRes.status, 403);

  // Admin assigns Delivery Agent B
  const assignRes = await server.client.post(`/api/orders/${unassignedOrderId}/assign`, { agentId: delBId }, { token: adminToken });
  assert.equal(assignRes.status, 200);
  assert.equal(assignRes.body.order.deliveryAgentId, String(delBId));
});

test('8. Return authorization: order ownership & status verification', async () => {
  // Customer B attempts to return Customer A's delivered order -> 403 Forbidden
  const notMyOrder = await server.client.post('/api/returns', {
    orderId: deliveredOrderId,
    productId: fixtures.productId,
    reason: 'Size issue'
  }, { token: custBToken });
  assert.equal(notMyOrder.status, 403);
  assert.match(notMyOrder.body.error.message, /Not your order/i);

  // Customer A attempts return on non-delivered order -> 409 Conflict
  const notDelivered = await server.client.post('/api/returns', {
    orderId: unassignedOrderId,
    productId: fixtures.productId,
    reason: 'Defective'
  }, { token: custAToken });
  assert.equal(notDelivered.status, 409);
  assert.match(notDelivered.body.error.message, /only allowed on delivered orders/i);

  // Customer A attempts return on non-existent product -> 404 Not Found
  const notInOrder = await server.client.post('/api/returns', {
    orderId: deliveredOrderId,
    productId: 999999,
    reason: 'Wrong item'
  }, { token: custAToken });
  assert.equal(notInOrder.status, 404);
  assert.match(notInOrder.body.error.message, /not part of this order/i);
});

test('9. Return window expiration (14 days) enforcement', async () => {
  // Set delivered_at to 20 days ago
  await pool.query("UPDATE deliveries SET delivered_at = now() - interval '20 days' WHERE order_id = $1", [deliveredOrderId]);

  const expiredRes = await server.client.post('/api/returns', {
    orderId: deliveredOrderId,
    productId: fixtures.productId,
    reason: 'Changed mind'
  }, { token: custAToken });

  assert.equal(expiredRes.status, 409);
  assert.match(expiredRes.body.error.message, /Return window has expired/i);
});

let createdReturnId;

test('10. Valid return within 14 days and duplicate return prevention', async () => {
  // Set delivered_at to 3 days ago
  await pool.query("UPDATE deliveries SET delivered_at = now() - interval '3 days' WHERE order_id = $1", [deliveredOrderId]);

  // Valid return request
  const returnRes = await server.client.post('/api/returns', {
    orderId: deliveredOrderId,
    productId: fixtures.productId,
    reason: 'Size or fit issue'
  }, { token: custAToken });

  assert.equal(returnRes.status, 201);
  assert.equal(returnRes.body.return.status, 'Requested');
  createdReturnId = returnRes.body.return.id;

  // Duplicate return request rejected with exact error message
  const dupRes = await server.client.post('/api/returns', {
    orderId: deliveredOrderId,
    productId: fixtures.productId,
    reason: 'Another return request'
  }, { token: custAToken });

  assert.equal(dupRes.status, 409);
  assert.match(dupRes.body.error.message, /Return request already exists for this item/i);
});

test('11. Admin return approval refunds payment and restores inventory atomically', async () => {
  const stockBefore = (await pool.query('SELECT stock FROM products WHERE id = $1', [fixtures.productId])).rows[0].stock;

  // Customer cannot approve return -> 403 Forbidden
  const custApprove = await server.client.post(`/api/returns/${createdReturnId}/approve`, {}, { token: custAToken });
  assert.equal(custApprove.status, 403);

  // Admin approves return
  const approveRes = await server.client.post(`/api/returns/${createdReturnId}/approve`, {}, { token: adminToken });
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.return.status, 'Refunded');

  // Stock restored by returned quantity (2)
  const stockAfter = (await pool.query('SELECT stock FROM products WHERE id = $1', [fixtures.productId])).rows[0].stock;
  assert.equal(stockAfter, stockBefore + 2);

  // Refund payment record exists with status Paid
  const { rows: refundPay } = await pool.query("SELECT * FROM payments WHERE order_id = $1 AND type = 'refund'", [deliveredOrderId]);
  assert.equal(refundPay.length, 1);
  assert.equal(refundPay[0].status, 'Paid');

  // Order paymentStatus now reflects 'Refunded'
  const orderRes = await server.client.get(`/api/orders/${deliveredOrderId}`, { token: custAToken });
  assert.equal(orderRes.body.order.paymentStatus, 'Refunded');

  // Duplicate approval attempt rejected
  const dupApprove = await server.client.post(`/api/returns/${createdReturnId}/approve`, {}, { token: adminToken });
  assert.equal(dupApprove.status, 409);
  assert.match(dupApprove.body.error.message, /Cannot approve return in status "Refunded"/i);
});
