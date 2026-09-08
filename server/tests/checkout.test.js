const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, seedFixtures, closeDb } = require('./helpers');
const { pool } = require('../src/db');

let server; let fixtures; let token; let userId;
const address = { name: 'T Cust', phone: '123', line1: '1 Main St', city: 'Springfield', region: 'IL', postalCode: '62701' };

before(async () => {
  server = await startServer();
  fixtures = await seedFixtures();
  const reg = await server.client.post('/api/auth/register', { name: 'Buyer', email: 'buyer@test.com', password: 'secret123' });
  token = reg.body.token;
  userId = reg.body.user.id;
});
after(async () => { await server.close(); await closeDb(); });

test('add to cart -> checkout -> creates order, payment, delivery; decrements stock; clears cart', async () => {
  // add 2 of the product (stock 10)
  const add = await server.client.post('/api/cart/items', { productId: fixtures.productId, quantity: 2 }, { token });
  assert.equal(add.status, 201);
  assert.equal(add.body.cart[0].quantity, 2);

  const checkout = await server.client.post('/api/orders/checkout', { address }, { token });
  assert.equal(checkout.status, 201);
  const order = checkout.body.order;
  assert.ok(order.orderNumber.startsWith('EC'));
  assert.equal(order.status, 'Payment Confirmed');
  assert.equal(order.paymentStatus, 'Paid');
  assert.equal(order.items[0].quantity, 2);

  // stock decremented 10 -> 8
  const { rows } = await pool.query('SELECT stock FROM products WHERE id = $1', [fixtures.productId]);
  assert.equal(rows[0].stock, 8);

  // cart cleared
  const cart = await server.client.get('/api/cart', { token });
  assert.equal(cart.body.cart.length, 0);

  // payment + delivery rows exist
  const pay = await pool.query('SELECT * FROM payments WHERE order_id = $1', [order.id]);
  assert.equal(pay.rows[0].status, 'Paid');
  const del = await pool.query('SELECT * FROM deliveries WHERE order_id = $1', [order.id]);
  assert.equal(del.rows[0].agent_id, fixtures.deliveryId);
});

test('checkout fails and rolls back when payment is declined (amount ending in .99)', async () => {
  // Product priced 50 -> force a failing amount by adjusting price to end in .99
  await pool.query('UPDATE products SET price = 20.99, stock = 5 WHERE id = $1', [fixtures.productId]);
  await server.client.post('/api/cart/items', { productId: fixtures.productId, quantity: 3 }, { token }); // 62.97 + 8 fee = 70.97 ... force fail via price
  // Make total end in .99 exactly: price 12.99 * 1 + 8 fee = 20.99
  await pool.query('UPDATE products SET price = 12.99 WHERE id = $1', [fixtures.productId]);
  await server.client.del('/api/cart', { token });
  await server.client.post('/api/cart/items', { productId: fixtures.productId, quantity: 1 }, { token });

  const res = await server.client.post('/api/orders/checkout', { address }, { token });
  assert.equal(res.status, 400);
  assert.match(res.body.error.message, /Payment failed/i);

  // No order created, stock untouched (5), cart still holds the item
  const orders = await server.client.get('/api/orders', { token });
  assert.equal(orders.body.orders.length, 1); // only the one from the previous test
  const { rows } = await pool.query('SELECT stock FROM products WHERE id = $1', [fixtures.productId]);
  assert.equal(rows[0].stock, 5);
});

test('checkout blocked when requesting more than available stock', async () => {
  await server.client.del('/api/cart', { token });
  await server.client.post('/api/cart/items', { productId: fixtures.productId, quantity: 2 }, { token });
  // Drop stock below the cart quantity to simulate a race
  await pool.query('UPDATE products SET stock = 1 WHERE id = $1', [fixtures.productId]);
  const res = await server.client.post('/api/orders/checkout', { address }, { token });
  assert.equal(res.status, 409);
  assert.match(res.body.error.message, /not have enough stock/i);
});
