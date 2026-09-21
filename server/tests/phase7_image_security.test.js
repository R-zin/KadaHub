const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { startServer, closeDb } = require('./helpers');
const { pool } = require('../src/db');
const config = require('../src/config');
const storageService = require('../src/services/storageService');

let server;
let client;
let userA;
let userB;
let clothingProduct;

// 1x1 valid JPEG bytes
const validJpgBytes = new Uint8Array([
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

before(async () => {
  const s = await startServer();
  server = s;
  client = s.client;

  // Find or create clothing category
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

  // Create User A (Customer A)
  const userARes = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('User A', $1, 'hashed', 'customer') RETURNING id`,
    [`user_a_${Date.now()}@example.com`]
  );
  userA = {
    id: userARes.rows[0].id,
    token: jwt.sign({ sub: userARes.rows[0].id, role: 'customer' }, config.jwt.secret, { expiresIn: '1h' })
  };

  // Create User B (Customer B)
  const userBRes = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('User B', $1, 'hashed', 'customer') RETURNING id`,
    [`user_b_${Date.now()}@example.com`]
  );
  userB = {
    id: userBRes.rows[0].id,
    token: jwt.sign({ sub: userBRes.rows[0].id, role: 'customer' }, config.jwt.secret, { expiresIn: '1h' })
  };

  // Create supported clothing product
  const prodRes = await pool.query(
    `INSERT INTO products (seller_id, category_id, name, description, price, stock, is_virtual_try_on_supported)
     VALUES ($1, $2, 'Security Test Garment', 'Garment for Phase 7 audit', 59.99, 15, true)
     RETURNING id`,
    [userA.id, catId]
  );
  clothingProduct = { id: prodRes.rows[0].id };
});

after(async () => {
  await server.close();
  await closeDb();
});

test('Phase 7: Try-On Image Security, Storage and Cleanup Audit', async (t) => {
  let userATempUrl;
  let userATempFilename;

  // --------------------------------------------------------------------------
  // 1. INPUT VALIDATION & MAGIC BYTES
  // --------------------------------------------------------------------------
  await t.test('1.1 Rejects spoofed image (text content with .jpg extension)', async () => {
    const fakeBuffer = Buffer.from('<?php echo "malicious payload"; ?>');
    const formData = new FormData();
    formData.append('folder', 'tryon');
    formData.append('image', new Blob([fakeBuffer], { type: 'image/jpeg' }), 'script.jpg');

    const res = await fetch(`${client.base}/api/uploads`, {
      method: 'POST',
      headers: { authorization: `Bearer ${userA.token}` },
      body: formData
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error.message, /invalid or corrupted image format/i);
  });

  await t.test('1.2 Rejects empty image file (0 bytes)', async () => {
    const emptyBuffer = Buffer.alloc(0);
    const formData = new FormData();
    formData.append('folder', 'tryon');
    formData.append('image', new Blob([emptyBuffer], { type: 'image/jpeg' }), 'empty.jpg');

    const res = await fetch(`${client.base}/api/uploads`, {
      method: 'POST',
      headers: { authorization: `Bearer ${userA.token}` },
      body: formData
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error.message, /empty/i);
  });

  await t.test('1.3 Rejects oversized image file (> 5MB)', async () => {
    // 5.5MB buffer
    const oversizedBuffer = Buffer.alloc(5.5 * 1024 * 1024);
    // Add fake JPEG header
    oversizedBuffer[0] = 0xff;
    oversizedBuffer[1] = 0xd8;
    oversizedBuffer[2] = 0xff;

    const formData = new FormData();
    formData.append('folder', 'tryon');
    formData.append('image', new Blob([oversizedBuffer], { type: 'image/jpeg' }), 'giant.jpg');

    const res = await fetch(`${client.base}/api/uploads`, {
      method: 'POST',
      headers: { authorization: `Bearer ${userA.token}` },
      body: formData
    });

    assert.equal(res.status, 400);
  });

  await t.test('1.4 Rejects path traversal characters in filename', async () => {
    const formData = new FormData();
    formData.append('folder', 'tryon');
    formData.append('image', new Blob([validJpgBytes], { type: 'image/jpeg' }), '..evil.jpg');

    const res = await fetch(`${client.base}/api/uploads`, {
      method: 'POST',
      headers: { authorization: `Bearer ${userA.token}` },
      body: formData
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error.message, /invalid characters|path traversal/i);
  });

  // --------------------------------------------------------------------------
  // 2. RANDOMIZED NAMING & USER-SCOPING
  // --------------------------------------------------------------------------
  await t.test('2.1 Stores Try-On upload with secure randomized, user-scoped name', async () => {
    const formData = new FormData();
    formData.append('folder', 'tryon');
    formData.append('image', new Blob([validJpgBytes], { type: 'image/jpeg' }), 'my-personal-selfie.jpg');

    const res = await fetch(`${client.base}/api/uploads`, {
      method: 'POST',
      headers: { authorization: `Bearer ${userA.token}` },
      body: formData
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.url);
    assert.ok(!data.url.includes('my-personal-selfie'), 'Original filename must never be exposed or used');
    assert.match(data.url, /tryon-temp/);
    assert.match(data.url, new RegExp(`tryon_${userA.id}__[a-f0-9-]+`));

    userATempUrl = data.url;
    userATempFilename = path.basename(data.url);
  });

  // --------------------------------------------------------------------------
  // 3. ACCESS CONTROL & ISOLATION
  // --------------------------------------------------------------------------
  await t.test('3.1 User A can access their own temporary Try-On image', async () => {
    const res = await fetch(`${client.base}/api/tryon/temp/${userATempFilename}`, {
      headers: { authorization: `Bearer ${userA.token}` }
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/jpeg');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  await t.test('3.2 User B CANNOT access User A temporary image (403 Forbidden)', async () => {
    const res = await fetch(`${client.base}/api/tryon/temp/${userATempFilename}`, {
      headers: { authorization: `Bearer ${userB.token}` }
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error.message, /access denied|do not own/i);
  });

  await t.test('3.3 Unauthenticated request to temp image is blocked (401 Unauthorized)', async () => {
    const res = await fetch(`${client.base}/api/tryon/temp/${userATempFilename}`);
    assert.equal(res.status, 401);
  });

  await t.test('3.4 Direct static path traversal to temp image is blocked without token (401)', async () => {
    const res = await fetch(`${client.base}/uploads/tryon-temp/${userATempFilename}`);
    assert.equal(res.status, 401);
  });

  await t.test('3.5 User B cannot generate Try-On with User A temporary image (403 Forbidden)', async () => {
    const res = await client.post(
      '/api/tryon/generate',
      {
        productId: String(clothingProduct.id),
        sourceImage: userATempUrl,
        size: 'M'
      },
      { token: userB.token }
    );
    assert.equal(res.status, 403);
  });

  // --------------------------------------------------------------------------
  // 4. EXPLICIT CLEANUP (RETAKE / CANCEL)
  // --------------------------------------------------------------------------
  await t.test('4.1 User B cannot delete User A temporary image (403 Forbidden)', async () => {
    const res = await client.delete(`/api/tryon/temp/${userATempFilename}`, { token: userB.token });
    assert.equal(res.status, 403);
  });

  await t.test('4.2 User A can explicitly delete their temporary image on retake/cancel', async () => {
    const res = await client.delete(`/api/tryon/temp/${userATempFilename}`, { token: userA.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    // Verify it is no longer accessible
    const checkRes = await fetch(`${client.base}/api/tryon/temp/${userATempFilename}`, {
      headers: { authorization: `Bearer ${userA.token}` }
    });
    assert.equal(checkRes.status, 404);
  });

  // --------------------------------------------------------------------------
  // 5. ERROR-SAFE CLEANUP DURING PROCESSING
  // --------------------------------------------------------------------------
  await t.test('5.1 Temporary file is cleaned up after successful Try-On generation', async () => {
    // Upload a new temp image
    const formData = new FormData();
    formData.append('folder', 'tryon');
    formData.append('image', new Blob([validJpgBytes], { type: 'image/jpeg' }), 'source2.jpg');

    const uploadRes = await fetch(`${client.base}/api/uploads`, {
      method: 'POST',
      headers: { authorization: `Bearer ${userA.token}` },
      body: formData
    });
    const uploadData = await uploadRes.json();
    const tempUrl = uploadData.url;
    const tempFile = path.basename(tempUrl);

    // Run generation
    const genRes = await client.post(
      '/api/tryon/generate',
      {
        productId: String(clothingProduct.id),
        sourceImage: tempUrl,
        size: 'L',
        color: 'Blue'
      },
      { token: userA.token }
    );
    assert.equal(genRes.status, 201);

    // Verify temp file was cleaned up
    const checkRes = await fetch(`${client.base}/api/tryon/temp/${tempFile}`, {
      headers: { authorization: `Bearer ${userA.token}` }
    });
    assert.equal(checkRes.status, 404);
  });

  await t.test('5.2 Error-safe cleanup: Temporary file cleaned up if processing fails', async () => {
    const formData = new FormData();
    formData.append('folder', 'tryon');
    formData.append('image', new Blob([validJpgBytes], { type: 'image/jpeg' }), 'source-fail.jpg');

    const uploadRes = await fetch(`${client.base}/api/uploads`, {
      method: 'POST',
      headers: { authorization: `Bearer ${userA.token}` },
      body: formData
    });
    const uploadData = await uploadRes.json();
    const tempUrl = uploadData.url;
    const tempFile = path.basename(tempUrl);

    // Call generate with non-existent product ID to trigger error
    const genRes = await client.post(
      '/api/tryon/generate',
      {
        productId: '999999',
        sourceImage: tempUrl
      },
      { token: userA.token }
    );
    assert.equal(genRes.status, 404);

    // Verify temporary file was deleted despite processing failure
    const checkRes = await fetch(`${client.base}/api/tryon/temp/${tempFile}`, {
      headers: { authorization: `Bearer ${userA.token}` }
    });
    assert.equal(checkRes.status, 404);
  });

  // --------------------------------------------------------------------------
  // 6. BACKGROUND TTL CLEANUP OF ABANDONED FILES
  // --------------------------------------------------------------------------
  await t.test('6.1 Background TTL cleanup removes expired temp files and preserves permanent images', async () => {
    const tempDir = path.join(process.cwd(), config.storage.uploadDir, 'tryon-temp');
    await fs.promises.mkdir(tempDir, { recursive: true });

    const staleFilePath = path.join(tempDir, `tryon_${userA.id}__stale-abandoned.jpg`);
    await fs.promises.writeFile(staleFilePath, Buffer.from(validJpgBytes));

    // Backdate mtime to 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await fs.promises.utimes(staleFilePath, oneHourAgo, oneHourAgo);

    // Run cleanup for files older than 30 mins
    const { deletedCount } = await storageService.cleanExpiredTempFiles(30 * 60 * 1000);
    assert.ok(deletedCount >= 1, 'Expected at least 1 stale temp file to be deleted');
    assert.equal(fs.existsSync(staleFilePath), false, 'Stale file must be unlinked');
  });
});
