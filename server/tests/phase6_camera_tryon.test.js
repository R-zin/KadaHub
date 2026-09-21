const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startServer, closeDb } = require('./helpers');
const { pool } = require('../src/db');
const config = require('../src/config');

let server;
let client;
let customerToken;
let customerId;
let clothingProductId;
let uploadedPhotoUrl;

before(async () => {
  const s = await startServer();
  server = s;
  client = s.client;

  let catRes = await pool.query(`SELECT id FROM categories WHERE slug = 'clothing'`);
  let catId = catRes.rows[0]?.id;
  if (!catId) {
    catRes = await pool.query(
      `INSERT INTO categories (name, slug, description, image, icon)
       VALUES ('Clothing', 'clothing', 'Apparel and fashion', 'https://example.com/cat.jpg', 'shirt')
       RETURNING id`
    );
    catId = catRes.rows[0].id;
  }

  const email = `camera_tester_${Date.now()}@example.com`;
  const userRes = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Camera Customer', $1, 'hashed', 'customer')
     RETURNING id`,
    [email]
  );
  customerId = userRes.rows[0].id;
  customerToken = jwt.sign(
    { sub: customerId, role: 'customer' },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  const prodRes = await pool.query(
    `INSERT INTO products (seller_id, category_id, name, description, price, stock, is_virtual_try_on_supported)
     VALUES ($1, $2, 'Camera Fit Shirt', 'A test shirt for try-on', 49.99, 20, true)
     RETURNING id`,
    [customerId, catId]
  );
  clothingProductId = prodRes.rows[0].id;
});

after(async () => {
  await server.close();
  await closeDb();
});

test('Phase 6: Live Camera Photo Capture & Try-On Pipeline Integration', async (t) => {
  await t.test('1. Upload simulated camera capture JPEG (Blob/File) to /api/uploads', async () => {
    // 1x1 valid JPEG bytes
    const fakeJpgBytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
      0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
      0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
      0x00, 0xbf, 0x00, 0xff, 0xd9
    ]);

    const formData = new FormData();
    const blob = new Blob([fakeJpgBytes], { type: 'image/jpeg' });
    formData.append('folder', 'tryon');
    formData.append('image', blob, 'camera-capture.jpg');

    const res = await fetch(`${client.base}/api/uploads`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${customerToken}`
      },
      body: formData
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.url, 'Expected uploaded photo URL');
    assert.match(data.url, /tryon/);

    uploadedPhotoUrl = data.url;
  });

  await t.test('2. Generate Try-On using uploaded camera capture image', async () => {
    const res = await client.post(
      '/api/tryon/generate',
      {
        productId: String(clothingProductId),
        sourceImage: uploadedPhotoUrl,
        size: 'L',
        color: 'Black'
      },
      { token: customerToken }
    );

    assert.equal(res.status, 201);
    assert.ok(res.body.result);
    assert.equal(res.body.result.sourceImage, uploadedPhotoUrl);
    assert.ok(res.body.result.previewImage);
    assert.equal(res.body.result.size, 'L');
    assert.equal(res.body.result.color, 'Black');
  });

  await t.test('3. Retrieve customer saved Try-On history', async () => {
    const res = await client.get('/api/tryon', { token: customerToken });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.results));
    assert.equal(res.body.results.length, 1);
    assert.equal(res.body.results[0].sourceImage, uploadedPhotoUrl);
  });

  await t.test('4. Validation: Missing sourceImage returns 400 Bad Request', async () => {
    const res = await client.post(
      '/api/tryon/generate',
      {
        productId: String(clothingProductId),
        size: 'M'
      },
      { token: customerToken }
    );

    assert.equal(res.status, 400);
  });

  await t.test('5. Validation: Missing productId returns 400 Bad Request', async () => {
    const res = await client.post(
      '/api/tryon/generate',
      {
        sourceImage: uploadedPhotoUrl,
        size: 'M'
      },
      { token: customerToken }
    );

    assert.equal(res.status, 400);
  });
});
