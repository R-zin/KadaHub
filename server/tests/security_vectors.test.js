const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, seedFixtures, closeDb } = require('./helpers');
const { pool } = require('../src/db');
const bcrypt = require('bcryptjs');

let server;
let fixtures;
let sellerAToken, sellerBToken;
let deliveryAToken, deliveryBToken;
let customerToken, adminToken;
let deactivatedToken;
let sellerAProductId, sellerBProductId;
let orderAssignedToDeliveryA;

before(async () => {
  server = await startServer();
  fixtures = await seedFixtures();

  const hash = await bcrypt.hash('password123', 10);
  const ins = (text, params) => pool.query(text, params).then((r) => r.rows[0]);

  // Create Seller B
  const sellerB = await ins(
    "INSERT INTO users (name,email,password_hash,role,store_name) VALUES ('Seller B','sellerb@test.com',$1,'seller','SellerB Store') RETURNING id",
    [hash]
  );
  // Create Delivery Agent B
  const deliveryB = await ins(
    "INSERT INTO users (name,email,password_hash,role) VALUES ('Delivery B','deliveryb@test.com',$1,'delivery') RETURNING id",
    [hash]
  );
  // Create Deactivated user
  const deactivated = await ins(
    "INSERT INTO users (name,email,password_hash,role,is_active) VALUES ('Inactive','inactive@test.com',$1,'customer',FALSE) RETURNING id",
    [hash]
  );

  // Products
  sellerAProductId = fixtures.productId;
  const prodB = await ins(
    `INSERT INTO products (seller_id,category_id,subcategory,name,price,stock)
     VALUES ($1,$2,'Shirts','Seller B Shirt',75,15) RETURNING id`,
    [sellerB.id, fixtures.categoryId]
  );
  sellerBProductId = prodB.id;

  // Log in existing accounts
  const aLogin = await server.client.post('/api/auth/login', { email: 'admin@test.com', password: 'password123' });
  adminToken = aLogin.body.token;

  const sALogin = await server.client.post('/api/auth/login', { email: 'seller@test.com', password: 'password123' });
  sellerAToken = sALogin.body.token;

  const sBLogin = await server.client.post('/api/auth/login', { email: 'sellerb@test.com', password: 'password123' });
  sellerBToken = sBLogin.body.token;

  const dALogin = await server.client.post('/api/auth/login', { email: 'delivery@test.com', password: 'password123' });
  deliveryAToken = dALogin.body.token;

  const dBLogin = await server.client.post('/api/auth/login', { email: 'deliveryb@test.com', password: 'password123' });
  deliveryBToken = dBLogin.body.token;

  // Customer
  const cReg = await server.client.post('/api/auth/register', {
    name: 'Customer One', email: 'cust1@test.com', password: 'password123', role: 'customer'
  });
  customerToken = cReg.body.token;
  const customerId = cReg.body.user.id;

  // Token for deactivated user
  const { signToken } = require('../src/middleware/auth');
  deactivatedToken = signToken({ id: deactivated.id, email: 'inactive@test.com', role: 'customer' });

  // Create an order assigned to Delivery Agent A
  const ord = await ins(
    `INSERT INTO orders (order_number, customer_id, status, subtotal, delivery_fee, discount, total,
       ship_name, ship_phone, ship_line1, ship_city, ship_region, ship_postal_code)
     VALUES ('ORD-TEST-101', $1, 'Shipped', 50, 0, 0, 50, 'Test Ship', '555-1234', '123 St', 'City', 'State', '12345')
     RETURNING id`,
    [customerId]
  );
  orderAssignedToDeliveryA = ord.id;
  await pool.query(
    `INSERT INTO deliveries (order_id, agent_id, status) VALUES ($1, $2, 'Shipped')`,
    [orderAssignedToDeliveryA, fixtures.deliveryId]
  );
});

after(async () => {
  await server.close();
  await closeDb();
});

test('Vector 1: Customer accessing Admin API -> 403 Forbidden', async () => {
  const res = await server.client.get('/api/admin/stats', { token: customerToken });
  assert.equal(res.status, 403);
});

test('Vector 2: Seller accessing Admin API -> 403 Forbidden', async () => {
  const res = await server.client.get('/api/admin/users', { token: sellerAToken });
  assert.equal(res.status, 403);
});

test('Vector 3: Delivery Agent accessing Admin API -> 403 Forbidden', async () => {
  const res = await server.client.get('/api/admin/stats', { token: deliveryAToken });
  assert.equal(res.status, 403);
});

test('Vector 4: Customer accessing Seller API (POST /api/products) -> 403 Forbidden', async () => {
  const res = await server.client.post('/api/products', {
    name: 'Unauthorized Product',
    price: 99,
    category: 'Clothing'
  }, { token: customerToken });
  assert.equal(res.status, 403);
});

test('Vector 5: Seller A attempting to edit Seller B product -> 403 Forbidden', async () => {
  const res = await server.client.put(`/api/products/${sellerBProductId}`, {
    name: 'Hacked By Seller A',
    price: 1
  }, { token: sellerAToken });
  assert.equal(res.status, 403);
});

test('Vector 6: Delivery Agent B attempting to update Delivery Agent A delivery -> 403 Forbidden', async () => {
  const res = await server.client.post(`/api/orders/${orderAssignedToDeliveryA}/advance`, {}, {
    token: deliveryBToken
  });
  assert.equal(res.status, 403);
});

test('Vector 7: Unauthenticated user accessing private API -> 401 Unauthorized', async () => {
  const res = await server.client.get('/api/cart');
  assert.equal(res.status, 401);
});

test('Vector 8: Deactivated user attempting to access private API -> 403 Forbidden', async () => {
  const res = await server.client.get('/api/auth/me', { token: deactivatedToken });
  assert.equal(res.status, 403);
});

test('Vector 9: Attempt to register admin through public registration -> 400 Bad Request', async () => {
  const res = await server.client.post('/api/auth/register', {
    name: 'Priv Escalation Attacker',
    email: 'eviladmin@test.com',
    password: 'password123',
    role: 'admin'
  });
  assert.equal(res.status, 400);
});
