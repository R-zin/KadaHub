const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startServer, seedFixtures, closeDb } = require('./helpers');
const { pool } = require('../src/db');
const config = require('../src/config');

test('Phase 8: Full KadaHub System Regression, E2E Business Flow & Release Verification', async (t) => {
  const { client, close } = await startServer();
  let fixtures;

  t.before(async () => {
    fixtures = await seedFixtures();
  });

  t.after(async () => {
    await close();
    await closeDb();
  });

  // Helper to register / login users
  const loginUser = async (email, password = 'password123') => {
    const res = await client.post('/api/auth/login', { email, password });
    assert.equal(res.status, 200, `Login failed for ${email}`);
    return { token: res.body.token, user: res.body.user };
  };

  // =========================================================================
  // 1. COMPLETE ROLE TEST (CUSTOMER, SELLER, DELIVERY AGENT, ADMIN)
  // =========================================================================
  await t.test('1. Role Authorization, Profile & Access Boundaries', async () => {
    // 1.1 Customer signup & login
    const custReg = await client.post('/api/auth/register', {
      name: 'E2E Customer',
      email: 'e2e_customer@test.com',
      password: 'password123',
      role: 'customer'
    });
    assert.equal(custReg.status, 201);
    const custToken = custReg.body.token;

    // Verify /api/auth/me
    const meRes = await client.get('/api/auth/me', { token: custToken });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.user.role, 'customer');

    // Customer CANNOT access seller, delivery advance/claim, or admin routes
    const custSellerAttempt = await client.post('/api/products', { name: 'Hack' }, { token: custToken });
    assert.equal(custSellerAttempt.status, 403);
    const custDelivAdvance = await client.post('/api/orders/1/advance', {}, { token: custToken });
    assert.equal(custDelivAdvance.status, 403);
    const custDelivClaim = await client.post('/api/orders/1/claim', {}, { token: custToken });
    assert.equal(custDelivClaim.status, 403);
    const custAdminAttempt = await client.get('/api/admin/stats', { token: custToken });
    assert.equal(custAdminAttempt.status, 403);

    // 1.2 Seller login
    const seller = await loginUser('seller@test.com');
    assert.equal(seller.user.role, 'seller');
    const sellerOrdersRes = await client.get('/api/orders', { token: seller.token });
    assert.equal(sellerOrdersRes.status, 200);
    // Seller cannot access admin
    const sellerAdminAttempt = await client.get('/api/admin/stats', { token: seller.token });
    assert.equal(sellerAdminAttempt.status, 403);

    // 1.3 Delivery Agent login
    const delivery = await loginUser('delivery@test.com');
    assert.equal(delivery.user.role, 'delivery');
    const delivOrdersRes = await client.get('/api/orders', { token: delivery.token });
    assert.equal(delivOrdersRes.status, 200);
    // Delivery cannot create products or access admin
    const delivProdAttempt = await client.post('/api/products', { name: 'Hack' }, { token: delivery.token });
    assert.equal(delivProdAttempt.status, 403);
    const delivAdminAttempt = await client.get('/api/admin/stats', { token: delivery.token });
    assert.equal(delivAdminAttempt.status, 403);

    // 1.4 Admin login
    const admin = await loginUser('admin@test.com');
    assert.equal(admin.user.role, 'admin');
    const adminStats = await client.get('/api/admin/stats', { token: admin.token });
    assert.equal(adminStats.status, 200);
    assert.ok(adminStats.body.stats);
  });

  // =========================================================================
  // 2. COMPLETE CONNECTED BUSINESS WORKFLOW (E2E)
  // =========================================================================
  await t.test('2. Complete Connected Business Flow (Seller -> Customer -> Razorpay -> Delivery -> Return -> Admin)', async () => {
    const seller = await loginUser('seller@test.com');
    const customer = await loginUser('e2e_customer@test.com');
    const delivery = await loginUser('delivery@test.com');
    const admin = await loginUser('admin@test.com');

    // 2.1 Seller creates product with multiple images, stock, and price
    const prodRes = await client.post('/api/products', {
      name: 'Premium Wool Overcoat',
      description: 'Handcrafted premium cold-weather wool coat with satin lining',
      price: 180,
      stock: 15,
      category: 'Clothing',
      subcategory: 'Dresses',
      isVirtualTryOnSupported: true,
      images: [
        'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80'
      ]
    }, { token: seller.token });
    assert.equal(prodRes.status, 201);
    const newProduct = prodRes.body.product;
    assert.equal(newProduct.name, 'Premium Wool Overcoat');
    assert.equal(Number(newProduct.stock), 15);
    assert.equal(Number(newProduct.price), 180);

    // 2.2 Customer searches, filters, and views the new product
    const searchRes = await client.get('/api/products?search=Wool&category=clothing');
    assert.equal(searchRes.status, 200);
    const found = searchRes.body.products.find(p => p.id === newProduct.id);
    assert.ok(found, 'Product must be discoverable via search and category filter');

    const detailRes = await client.get(`/api/products/${newProduct.id}`);
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.body.product.name, 'Premium Wool Overcoat');
    assert.equal(detailRes.body.product.images.length, 2);

    // 2.3 Customer adds product to cart
    const addCart = await client.post('/api/cart/items', {
      productId: newProduct.id,
      quantity: 2
    }, { token: customer.token });
    assert.equal(addCart.status, 201);

    const cartView = await client.get('/api/cart', { token: customer.token });
    assert.equal(cartView.status, 200);
    assert.equal(cartView.body.cart.length, 1);
    assert.equal(cartView.body.cart[0].product.id, String(newProduct.id));
    assert.equal(cartView.body.cart[0].quantity, 2);

    // 2.4 Razorpay order creation
    const razorpayOrder = await client.post('/api/orders/razorpay/create-order', {}, { token: customer.token });
    assert.equal(razorpayOrder.status, 201);
    assert.ok(razorpayOrder.body.order_id);
    assert.equal(razorpayOrder.body.currency, 'INR');
    assert.ok(razorpayOrder.body.amount > 0);

    // 2.5 Simulate valid Razorpay payment signature & Checkout confirmation
    const rzpOrderId = razorpayOrder.body.order_id;
    const rzpPaymentId = `pay_e2e_${Date.now()}`;
    let validSignature = 'mock_sig_valid_test_token_12345';
    const keySecret = config.payment?.razorpayKeySecret;
    if (keySecret && keySecret !== 'test_secret_key_12345') {
      const signaturePayload = `${rzpOrderId}|${rzpPaymentId}`;
      validSignature = crypto
        .createHmac('sha256', keySecret)
        .update(signaturePayload)
        .digest('hex');
    }

    // Customer finalizes checkout
    const checkoutRes = await client.post('/api/orders/checkout', {
      address: {
        name: 'E2E Tester',
        line1: '456 Innovation Boulevard',
        city: 'Metropolis',
        region: 'Karnataka',
        postalCode: '560001',
        phone: '+919876543210'
      },
      payment: {
        razorpay_order_id: rzpOrderId,
        razorpay_payment_id: rzpPaymentId,
        razorpay_signature: validSignature
      }
    }, { token: customer.token });

    assert.equal(checkoutRes.status, 201);
    const createdOrder = checkoutRes.body.order;
    assert.ok(createdOrder.id);
    assert.equal(createdOrder.paymentStatus, 'Paid');
    assert.equal(Number(createdOrder.subtotal), 360);
    assert.equal(Number(createdOrder.total), Number(createdOrder.subtotal) + Number(createdOrder.deliveryFee || 0));

    // 2.6 Verify Cart is cleared and Inventory is deducted
    const cartAfterCheckout = await client.get('/api/cart', { token: customer.token });
    assert.equal(cartAfterCheckout.body.cart.length, 0, 'Cart must be cleared after checkout');

    const productAfterCheckout = await client.get(`/api/products/${newProduct.id}`);
    assert.equal(Number(productAfterCheckout.body.product.stock), 13, 'Stock must deduct 2 items (15 -> 13)');

    // 2.7 Delivery Agent Workflow
    // Assigned delivery agent advances status: Payment Confirmed -> Processing -> Dispatched -> Shipped -> Out for Delivery -> Delivered
    const statusSequence = [
      'Processing',
      'Dispatched',
      'Shipped',
      'Out for Delivery',
      'Delivered'
    ];

    for (const expectedStatus of statusSequence) {
      const advRes = await client.post(`/api/orders/${createdOrder.id}/advance`, {}, { token: delivery.token });
      assert.equal(advRes.status, 200, `Failed to update delivery to ${expectedStatus}`);
      assert.equal(advRes.body.order.status, expectedStatus);
    }

    // 2.8 Customer Tracks Order & Submits Return
    const orderDetails = await client.get(`/api/orders/${createdOrder.id}`, { token: customer.token });
    assert.equal(orderDetails.status, 200);
    assert.equal(orderDetails.body.order.status, 'Delivered');

    const returnReq = await client.post('/api/returns', {
      orderId: createdOrder.id,
      productId: newProduct.id,
      reason: 'Wrong size requested; coat sleeves are slightly too long'
    }, { token: customer.token });
    assert.equal(returnReq.status, 201);
    const returnId = returnReq.body.return.id;
    assert.equal(returnReq.body.return.status, 'Requested');

    // Duplicate return request must be rejected
    const dupReturn = await client.post('/api/returns', {
      orderId: createdOrder.id,
      productId: newProduct.id,
      reason: 'Duplicate return attempt'
    }, { token: customer.token });
    assert.equal(dupReturn.status, 409);

    // 2.9 Admin Reviews and Approves Return -> Refund Processed & Inventory Restored
    const adminReturns = await client.get('/api/returns', { token: admin.token });
    assert.equal(adminReturns.status, 200);
    const pendingReturn = adminReturns.body.returns.find(r => r.id === String(returnId));
    assert.ok(pendingReturn, 'Return request must be visible to Admin');

    const approveRes = await client.post(`/api/returns/${returnId}/approve`, {}, { token: admin.token });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.body.return.status, 'Refunded');

    // Verify inventory restored (13 -> 15)
    const productAfterRefund = await client.get(`/api/products/${newProduct.id}`);
    assert.equal(Number(productAfterRefund.body.product.stock), 15, 'Restocking must restore inventory to 15');

    // Verify refund payment record exists
    const paymentCheck = await pool.query('SELECT * FROM payments WHERE order_id = $1 AND type = $2', [createdOrder.id, 'refund']);
    assert.equal(paymentCheck.rows.length, 1);
    assert.equal(paymentCheck.rows[0].status, 'Paid');

    // Verify customer notification sent
    const notifCheck = await pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [customer.user.id]);
    assert.ok(notifCheck.rows.length > 0);
    assert.ok(notifCheck.rows[0].message.includes('approved'));
  });

  // =========================================================================
  // 3. TRY-ON SUPPORT FLOW & IMAGE LIFECYCLE
  // =========================================================================
  await t.test('3. Try-On Support Flow & Temporary Image Security', async () => {
    const customer = await loginUser('e2e_customer@test.com');
    const seller = await loginUser('seller@test.com');

    // 3.1 Upload valid camera capture JPEG (magic bytes \xFF\xD8\xFF)
    const boundary = '----WebKitFormBoundaryE2ETest';
    const fakeJpegBytes = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43
    ]);

    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="folder"\r\n\r\ntryon\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="camera-selfie.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      fakeJpegBytes,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const uploadRes = await fetch(`${client.base}/api/uploads`, {
      method: 'POST',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        authorization: `Bearer ${customer.token}`
      },
      body: multipartBody
    });
    assert.equal(uploadRes.status, 201);
    const uploadData = await uploadRes.json();
    assert.ok(uploadData.url.includes('tryon-temp'));
    assert.ok(uploadData.url.includes(`tryon_${customer.user.id}__`));

    // 3.2 Customer generates Try-On
    const tryonRes = await client.post('/api/tryon/generate', {
      productId: fixtures.productId,
      sourceImage: uploadData.url,
      selectedColor: 'Black',
      selectedSize: 'M'
    }, { token: customer.token });
    assert.equal(tryonRes.status, 201);
    assert.ok(tryonRes.body.result && tryonRes.body.result.previewImage);

    // Temporary image should now be automatically deleted
    const tempFilename = uploadData.url.split('/').pop();
    const accessAfterCleanup = await client.get(`/api/tryon/temp/${tempFilename}`, { token: customer.token });
    assert.equal(accessAfterCleanup.status, 404, 'Temporary file must be deleted after Try-On generation');

    // 3.3 Test Cancellation / Retake explicit cleanup
    const secondUpload = await fetch(`${client.base}/api/uploads`, {
      method: 'POST',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        authorization: `Bearer ${customer.token}`
      },
      body: multipartBody
    });
    assert.equal(secondUpload.status, 201);
    const secondData = await secondUpload.json();
    const secondFilename = secondData.url.split('/').pop();

    // Cross-user (seller) cannot delete customer's temp file
    const unauthorizedDel = await client.del(`/api/tryon/temp/${secondFilename}`, { token: seller.token });
    assert.equal(unauthorizedDel.status, 403);

    // Customer cancels/retakes photo -> explicit delete
    const cancelDelete = await client.del(`/api/tryon/temp/${secondFilename}`, { token: customer.token });
    assert.equal(cancelDelete.status, 200);

    // Verify it is gone
    const verifyGone = await client.get(`/api/tryon/temp/${secondFilename}`, { token: customer.token });
    assert.equal(verifyGone.status, 404);
  });

  // =========================================================================
  // 4. SECURITY & EXPLOIT ATTEMPTS AUDIT
  // =========================================================================
  await t.test('4. Security & Exploit Attempt Hardening', async () => {
    // 4.1 SQL Injection attempts in search and path params
    const sqliSearch = await client.get("/api/products?search=' OR '1'='1");
    assert.equal(sqliSearch.status, 200); // Handled safely via parameterized query
    assert.ok(Array.isArray(sqliSearch.body.products));

    const sqliId = await client.get("/api/products/1;DROP TABLE users;--");
    assert.ok([400, 404].includes(sqliId.status)); // Safe rejection, not 500

    // 4.2 Malformed and expired JWTs
    const badJwt = await client.get('/api/orders', { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.bad.signature' });
    assert.equal(badJwt.status, 401);

    // 4.3 Public registration cannot elevate role to admin
    const fakeAdmin = await client.post('/api/auth/register', {
      name: 'Fake Admin',
      email: 'fake_admin@test.com',
      password: 'password123',
      role: 'admin'
    });
    assert.equal(fakeAdmin.status, 400);

    // 4.4 Seller B cannot modify Seller A's product
    const sellerB = await client.post('/api/auth/register', {
      name: 'Seller Beta',
      email: 'seller_beta@test.com',
      password: 'password123',
      role: 'seller',
      storeName: 'BetaStore'
    });
    assert.equal(sellerB.status, 201);

    const modifyAttempt = await client.put(`/api/products/${fixtures.productId}`, {
      name: 'Hijacked Product'
    }, { token: sellerB.body.token });
    assert.equal(modifyAttempt.status, 403);
  });

  // =========================================================================
  // 5. DATABASE INTEGRITY AUDIT
  // =========================================================================
  await t.test('5. Database Consistency & Integrity Verification', async () => {
    // 5.1 No negative stock
    const negStock = await pool.query('SELECT id, name, stock FROM products WHERE stock < 0');
    assert.equal(negStock.rows.length, 0, 'No products may have negative stock');

    // 5.2 No orphan order items
    const orphanItems = await pool.query(`
      SELECT oi.id FROM order_items oi
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE o.id IS NULL
    `);
    assert.equal(orphanItems.rows.length, 0, 'No orphan order items');

    // 5.3 No orphan payments
    const orphanPayments = await pool.query(`
      SELECT p.id FROM payments p
      LEFT JOIN orders o ON p.order_id = o.id
      WHERE o.id IS NULL
    `);
    assert.equal(orphanPayments.rows.length, 0, 'No orphan payments');

    // 5.4 No orphan deliveries
    const orphanDeliveries = await pool.query(`
      SELECT d.id FROM deliveries d
      LEFT JOIN orders o ON d.order_id = o.id
      WHERE o.id IS NULL
    `);
    assert.equal(orphanDeliveries.rows.length, 0, 'No orphan deliveries');

    // 5.5 No orphan returns
    const orphanReturns = await pool.query(`
      SELECT r.id FROM returns r
      LEFT JOIN orders o ON r.order_id = o.id
      WHERE o.id IS NULL
    `);
    assert.equal(orphanReturns.rows.length, 0, 'No orphan returns');

    // 5.6 Order total matches calculated item totals + delivery fee
    const orderAudit = await pool.query(`
      SELECT o.id, o.total, o.subtotal, o.delivery_fee,
             COALESCE(SUM(oi.unit_price * oi.quantity), 0) AS calculated_subtotal
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id
    `);
    for (const row of orderAudit.rows) {
      assert.equal(
        Number(row.subtotal),
        Number(row.calculated_subtotal),
        `Order ${row.id} subtotal mismatch`
      );
      assert.equal(
        Number(row.total),
        Number(row.calculated_subtotal) + Number(row.delivery_fee),
        `Order ${row.id} total mismatch`
      );
    }
  });
});
