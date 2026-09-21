const { test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { startServer, seedFixtures, closeDb } = require('./helpers');
const { pool } = require('../src/db');
const paymentService = require('../src/services/paymentService');

let server;
let fixtures;
let token;
let userId;
const address = {
  name: 'Test Customer',
  phone: '9876543210',
  line1: '123 Test Street',
  city: 'Mumbai',
  region: 'MH',
  postalCode: '400001'
};

before(async () => {
  server = await startServer();
  fixtures = await seedFixtures();
  const reg = await server.client.post('/api/auth/register', {
    name: 'Razorpay Buyer',
    email: `rzp_buyer_${Date.now()}@test.com`,
    password: 'Password123!'
  });
  token = reg.body.token;
  userId = reg.body.user.id;
});

after(async () => {
  await server.close();
  await closeDb();
});

test('Razorpay HMAC verification helper correctly validates authentic and inauthentic signatures', () => {
  const secret = 'test_secret_key_12345';
  const orderId = 'order_test_123';
  const paymentId = 'pay_test_456';
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const validResult = paymentService.verifyRazorpayHmac(orderId, paymentId, expectedSig, secret);
  assert.equal(validResult.valid, true);

  const corruptedSig = expectedSig.slice(0, -1) + (expectedSig.slice(-1) === 'a' ? 'b' : 'a');
  const invalidResult = paymentService.verifyRazorpayHmac(orderId, paymentId, corruptedSig, secret);
  assert.equal(invalidResult.valid, false);

  const missingResult = paymentService.verifyRazorpayHmac('', paymentId, expectedSig, secret);
  assert.equal(missingResult.valid, false);
});

test('POST /api/orders/razorpay/create-order fails if cart is empty', async () => {
  const res = await server.client.post('/api/orders/razorpay/create-order', {}, { token });
  assert.equal(res.status, 400);
  assert.match(res.body.error.message, /cart is empty/i);
});

test('POST /api/orders/razorpay/create-order generates authoritative order with INR currency and paise amount', async () => {
  // Add product to cart (fixtures.productId has price 50)
  // 1 item * 50 + 8 fee = 58 total => 5800 paise
  await server.client.post('/api/cart/items', { productId: fixtures.productId, quantity: 1 }, { token });

  const res = await server.client.post('/api/orders/razorpay/create-order', {}, { token });
  assert.equal(res.status, 201);
  assert.ok(res.body.order_id);
  assert.equal(res.body.currency, 'INR');
  assert.equal(res.body.amount, 5800); // 58 * 100 paise
  assert.ok(res.body.key_id);
});

test('POST /api/orders/razorpay/verify-payment succeeds for valid signature and fails for invalid signature', async () => {
  const orderId = 'order_rzp_mock_1';
  const paymentId = 'pay_rzp_mock_1';
  const validSig = 'mock_sig_valid_test_token_12345';

  const validRes = await server.client.post(
    '/api/orders/razorpay/verify-payment',
    {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: validSig
    },
    { token }
  );
  assert.equal(validRes.status, 200);
  assert.equal(validRes.body.verified, true);

  const invalidRes = await server.client.post(
    '/api/orders/razorpay/verify-payment',
    {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: 'invalid_signature'
    },
    { token }
  );
  assert.equal(invalidRes.status, 400);
  assert.match(invalidRes.body.error.message, /verification failed/i);
});

test('POST /api/orders/checkout with Razorpay details creates order and prevents duplicate payment submission', async () => {
  const paymentId = `pay_rzp_${Date.now()}`;
  const payment = {
    razorpay_order_id: `order_rzp_${Date.now()}`,
    razorpay_payment_id: paymentId,
    razorpay_signature: 'mock_sig_valid_test_token_12345'
  };

  const checkoutRes = await server.client.post('/api/orders/checkout', { address, payment }, { token });
  assert.equal(checkoutRes.status, 201);
  const order = checkoutRes.body.order;
  assert.equal(order.paymentStatus, 'Paid');

  // Verify payment was recorded in DB with provider 'razorpay'
  const { rows: payments } = await pool.query('SELECT * FROM payments WHERE order_id = $1', [order.id]);
  assert.equal(payments.length, 1);
  assert.equal(payments[0].provider, 'razorpay');
  assert.equal(payments[0].provider_ref, paymentId);
  assert.equal(payments[0].status, 'Paid');

  // Attempt duplicate checkout with same payment ID
  // Add an item to cart first so cart isn't empty
  await server.client.post('/api/cart/items', { productId: fixtures.productId, quantity: 1 }, { token });
  const dupRes = await server.client.post('/api/orders/checkout', { address, payment }, { token });
  assert.equal(dupRes.status, 409);
  assert.match(dupRes.body.error.message, /already been processed/i);
});

test('POST /api/payments/razorpay/webhook accepts webhook event and returns HTTP 200', async () => {
  const res = await server.client.post('/api/payments/razorpay/webhook', {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_webhook_test_1',
          amount: 5800,
          currency: 'INR',
          status: 'captured'
        }
      }
    }
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.received, true);
});

test('Razorpay order return approval issues refund and restores inventory', async () => {
  // 1. Create product & place order with Razorpay
  await pool.query('UPDATE products SET stock = 10 WHERE id = $1', [fixtures.productId]);
  await server.client.del('/api/cart', { token });
  await server.client.post('/api/cart/items', { productId: fixtures.productId, quantity: 2 }, { token });

  const paymentId = `pay_rzp_refund_${Date.now()}`;
  const checkoutRes = await server.client.post('/api/orders/checkout', {
    address,
    payment: {
      razorpay_order_id: `order_rzp_ref_${Date.now()}`,
      razorpay_payment_id: paymentId,
      razorpay_signature: 'mock_sig_valid_test_token_12345'
    }
  }, { token });
  assert.equal(checkoutRes.status, 201);
  const orderId = checkoutRes.body.order.id;

  // Stock decremented 10 -> 8
  const { rows: stockAfterOrder } = await pool.query('SELECT stock FROM products WHERE id = $1', [fixtures.productId]);
  assert.equal(stockAfterOrder[0].stock, 8);

  // 2. Mark order as Delivered
  await pool.query("UPDATE orders SET status = 'Delivered' WHERE id = $1", [orderId]);
  await pool.query("UPDATE deliveries SET status = 'Delivered', delivered_at = now() WHERE order_id = $1", [orderId]);

  // 3. Customer requests return
  const returnRes = await server.client.post('/api/returns', {
    orderId,
    productId: fixtures.productId,
    reason: 'Wrong size delivered'
  }, { token });
  assert.equal(returnRes.status, 201);
  const returnId = returnRes.body.return.id;

  // 4. Admin approves return
  const adminLogin = await server.client.post('/api/auth/login', { email: 'admin@test.com', password: 'password123' });
  const adminToken = adminLogin.body.token;
  const approveRes = await server.client.post(`/api/returns/${returnId}/approve`, {}, { token: adminToken });
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.return.status, 'Refunded');

  // 5. Verify refund in payments table
  const { rows: refundRows } = await pool.query(
    "SELECT * FROM payments WHERE order_id = $1 AND type = 'refund'",
    [orderId]
  );
  assert.equal(refundRows.length, 1);
  assert.equal(refundRows[0].provider, 'razorpay');
  assert.equal(refundRows[0].status, 'Paid');
  assert.equal(refundRows[0].amount, 100); // 2 items * 50 = 100

  // 6. Verify inventory restored 8 -> 10
  const { rows: stockAfterRefund } = await pool.query('SELECT stock FROM products WHERE id = $1', [fixtures.productId]);
  assert.equal(stockAfterRefund[0].stock, 10);
});
