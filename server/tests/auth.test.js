const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, seedFixtures, closeDb } = require('./helpers');

let server;
before(async () => {
  server = await startServer();
  await seedFixtures();
});
after(async () => { await server.close(); await closeDb(); });

test('register creates a customer and returns a token', async () => {
  const res = await server.client.post('/api/auth/register', {
    name: 'Test Customer', email: 'cust@test.com', password: 'secret123', role: 'customer'
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.token);
  assert.equal(res.body.user.role, 'customer');
  assert.equal(res.body.user.email, 'cust@test.com');
});

test('register rejects a duplicate email', async () => {
  await server.client.post('/api/auth/register', { name: 'Dup', email: 'dup@test.com', password: 'secret123' });
  const res = await server.client.post('/api/auth/register', { name: 'Dup', email: 'dup@test.com', password: 'secret123' });
  assert.equal(res.status, 409);
});

test('login succeeds with correct credentials and fails with wrong password', async () => {
  await server.client.post('/api/auth/register', { name: 'Login', email: 'login@test.com', password: 'secret123' });
  const ok = await server.client.post('/api/auth/login', { email: 'login@test.com', password: 'secret123' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);

  const bad = await server.client.post('/api/auth/login', { email: 'login@test.com', password: 'wrong' });
  assert.equal(bad.status, 401);
});

test('GET /api/auth/me returns the profile for a valid token and 401 without one', async () => {
  const login = await server.client.post('/api/auth/login', { email: 'seller@test.com', password: 'password123' });
  const token = login.body.token;

  const me = await server.client.get('/api/auth/me', { token });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.role, 'seller');

  const noAuth = await server.client.get('/api/auth/me');
  assert.equal(noAuth.status, 401);
});

test('RBAC: a customer cannot access admin routes', async () => {
  const reg = await server.client.post('/api/auth/register', { name: 'Cust2', email: 'cust2@test.com', password: 'secret123' });
  const res = await server.client.get('/api/admin/stats', { token: reg.body.token });
  assert.equal(res.status, 403);
});
