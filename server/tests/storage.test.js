const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { startServer, seedFixtures, closeDb } = require('./helpers');
const storageService = require('../src/services/storageService');

let server;
let fixtures;
let sellerToken;

before(async () => {
  server = await startServer();
  fixtures = await seedFixtures();
  const login = await server.client.post('/api/auth/login', {
    email: 'seller@test.com',
    password: 'password123'
  });
  sellerToken = login.body.token;
});

after(async () => {
  await server.close();
  await closeDb();
});

test('storageService localDriver saves buffer and returns accessible URL path', async () => {
  const dummyBuffer = Buffer.from('fake-image-binary-data');
  const res = await storageService.localDriver.save(dummyBuffer, { ext: '.jpg', folder: 'products' });
  assert.ok(res.url);
  assert.match(res.url, /^\/uploads\/products\/\d+-[a-f0-9]+\.jpg$/);

  // Verify file was written to disk
  const relativePath = res.url.replace(/^\//, '');
  const fullPath = path.join(process.cwd(), relativePath);
  assert.ok(fs.existsSync(fullPath));

  // Clean up test file
  fs.unlinkSync(fullPath);
});

test('storageService supabaseDriver generates public Supabase Storage URL', () => {
  assert.equal(typeof storageService.supabaseDriver.save, 'function');
});

test('POST /api/uploads rejects non-image uploads', async () => {
  const boundary = '----WebKitFormBoundaryTest';
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="images"; filename="malicious.exe"',
    'Content-Type: application/x-msdownload',
    '',
    'binary payload',
    `--${boundary}--`
  ].join('\r\n');

  const res = await fetch(`${server.client.base}/api/uploads`, {
    method: 'POST',
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      authorization: `Bearer ${sellerToken}`
    },
    body
  });

  assert.equal(res.status, 400);
  const json = await res.json();
  assert.match(json.error.message, /only image uploads are allowed/i);
});

test('POST /api/uploads successfully uploads a product image', async () => {
  const boundary = '----WebKitFormBoundaryTest';
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="images"; filename="sample.png"',
    'Content-Type: image/png',
    '',
    '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR',
    `--${boundary}--`
  ].join('\r\n');

  const res = await fetch(`${server.client.base}/api/uploads`, {
    method: 'POST',
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      authorization: `Bearer ${sellerToken}`
    },
    body
  });

  assert.equal(res.status, 201);
  const json = await res.json();
  assert.ok(json.url);
  assert.ok(Array.isArray(json.urls));
  assert.equal(json.urls.length, 1);
});
