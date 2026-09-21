const http = require('http');
const app = require('../src/app');
const { pool } = require('../src/db');

/** Start the app on an ephemeral port and return a tiny fetch client + close fn. */
const startServer = () =>
  new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const base = `http://127.0.0.1:${port}`;
      const client = {
        base,
        async req(method, path, { body, token, rawBody, headers } = {}) {
          const res = await fetch(base + path, {
            method,
            headers: {
              'content-type': 'application/json',
              ...(token ? { authorization: `Bearer ${token}` } : {}),
              ...headers
            },
            body: rawBody !== undefined ? rawBody : (body ? JSON.stringify(body) : undefined)
          });
          let json = null;
          try { json = await res.json(); } catch { /* no body */ }
          return { status: res.status, body: json, headers: res.headers };
        },
        get(p, o) { return this.req('GET', p, o); },
        post(p, b, o = {}) { return this.req('POST', p, { ...o, body: b }); },
        patch(p, b, o = {}) { return this.req('PATCH', p, { ...o, body: b }); },
        put(p, b, o = {}) { return this.req('PUT', p, { ...o, body: b }); },
        del(p, o) { return this.req('DELETE', p, o); },
        delete(p, o) { return this.del(p, o); }
      };
      resolve({ client, close: () => new Promise((r) => server.close(r)) });
    });
  });

/** Minimal fixtures: one category, one seller, one product. Returns ids. */
const seedFixtures = async () => {
  await pool.query(`
    TRUNCATE notifications, tryon_results, returns, deliveries, payments,
             order_items, orders, cart_items, wishlist_items, addresses,
             product_images, products, category_subcategories, categories, users
    RESTART IDENTITY CASCADE
  `);
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('password123', 10);

  const ins = (text, params) => pool.query(text, params).then((r) => r.rows[0]);

  const seller = await ins(
    "INSERT INTO users (name,email,password_hash,role,store_name) VALUES ('Sell','seller@test.com',$1,'seller','TestStore') RETURNING id",
    [hash]
  );
  const delivery = await ins(
    "INSERT INTO users (name,email,password_hash,role) VALUES ('Del','delivery@test.com',$1,'delivery') RETURNING id",
    [hash]
  );
  const admin = await ins(
    "INSERT INTO users (name,email,password_hash,role) VALUES ('Adm','admin@test.com',$1,'admin') RETURNING id",
    [hash]
  );
  const category = await ins(
    "INSERT INTO categories (name,slug) VALUES ('Clothing','clothing') RETURNING id"
  );
  await pool.query(
    "INSERT INTO category_subcategories (category_id, name) VALUES ($1, 'T-Shirts'), ($1, 'Shirts'), ($1, 'Dresses')",
    [category.id]
  );
  const product = await ins(
    `INSERT INTO products (seller_id,category_id,subcategory,name,price,stock,is_virtual_try_on_supported)
     VALUES ($1,$2,'T-Shirts','Test Tee',50,10,TRUE) RETURNING id`,
    [seller.id, category.id]
  );
  await pool.query('INSERT INTO product_images (product_id,url,sort_order) VALUES ($1,$2,0)', [
    product.id, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80'
  ]);

  return { sellerId: seller.id, deliveryId: delivery.id, adminId: admin.id, categoryId: category.id, productId: product.id };
};

const closeDb = () => pool.end();

module.exports = { startServer, seedFixtures, closeDb };
