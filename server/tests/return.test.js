const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, seedFixtures, closeDb } = require('./helpers');
const { pool } = require('../src/db');

let server; let fixtures; let customerToken; let adminToken; let orderId;
const address = { name: 'T Cust', phone: '123', line1: '1 Main St', city: 'Springfield', region: 'IL', postalCode: '62701' };

before(async () => {
  server = await startServer();
  fixtures = await seedFixtures();

  const reg = await server.client.post('/api/auth/register', { name: 'Buyer', email: 'buyer@test.com', password: 'secret123' });
  customerToken = reg.body.token;
  const admin = await server.client.post('/api/auth/login', { email: 'admin@test.com', password: 'password123' });
  adminToken = admin.body.token;

  // Place an order for 2 units, then mark it Delivered so it can be returned.
  await server.client.post('/api/cart/items', { productId: fixtures.productId, quantity: 2 }, { token: customerToken });
  const co = await server.client.post('/api/orders/checkout', { address }, { token: customerToken });
  orderId = co.body.order.id;
  await pool.query("UPDATE orders SET status = 'Delivered' WHERE id = $1", [orderId]);
});
after(async () => { await server.close(); await closeDb(); });

test('customer requests a return on a delivered order', async () => {
  const res = await server.client.post('/api/returns', { orderId, productId: fixtures.productId, reason: 'Size issue' }, { token: customerToken });
  assert.equal(res.status, 201);
  assert.equal(res.body.return.status, 'Requested');
});

test('admin approves the return: refund recorded and stock restored', async () => {
  const stockBefore = (await pool.query('SELECT stock FROM products WHERE id = $1', [fixtures.productId])).rows[0].stock;

  const { rows: returns } = await pool.query('SELECT id FROM returns WHERE order_id = $1', [orderId]);
  const approve = await server.client.post(`/api/returns/${returns[0].id}/approve`, {}, { token: adminToken });
  assert.equal(approve.status, 200);
  assert.equal(approve.body.return.status, 'Refunded');

  // stock restored by the returned quantity (2)
  const stockAfter = (await pool.query('SELECT stock FROM products WHERE id = $1', [fixtures.productId])).rows[0].stock;
  assert.equal(stockAfter, stockBefore + 2);

  // a refund payment row exists
  const refunds = await pool.query("SELECT * FROM payments WHERE order_id = $1 AND type = 'refund'", [orderId]);
  assert.equal(refunds.rows.length, 1);
  assert.equal(refunds.rows[0].status, 'Paid');

  // order now reads as Refunded
  const order = await server.client.get(`/api/orders/${orderId}`, { token: customerToken });
  assert.equal(order.body.order.paymentStatus, 'Refunded');
});

test('a customer cannot approve a return (RBAC)', async () => {
  const { rows: returns } = await pool.query('SELECT id FROM returns LIMIT 1');
  const res = await server.client.post(`/api/returns/${returns[0].id}/approve`, {}, { token: customerToken });
  assert.equal(res.status, 403);
});
