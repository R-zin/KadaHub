const bcrypt = require('bcryptjs');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const { query } = require('../db');
const { publicUser } = require('./authDomain');

/** Aggregate dashboard stats for the admin overview. */
const stats = async () => {
  const [rev, counts] = await Promise.all([
    query(`
      SELECT
        COALESCE(SUM(
          CASE
            WHEN p.type = 'charge' AND p.status = 'Paid' THEN p.amount
            WHEN p.type = 'refund' AND p.status = 'Paid' THEN -p.amount
            ELSE 0
          END
        ), 0) AS revenue,
        COUNT(DISTINCT CASE WHEN o.status <> 'Cancelled' THEN o.id END) AS orders
      FROM orders o
      LEFT JOIN payments p ON p.order_id = o.id
      WHERE o.status <> 'Cancelled'
    `),
    query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM users WHERE is_active = TRUE) AS active_users,
        (SELECT COUNT(*) FROM users WHERE role = 'seller') AS sellers,
        (SELECT COUNT(*) FROM products) AS products,
        (SELECT COUNT(*) FROM products WHERE stock > 0 AND stock <= 20) AS low_stock,
        (SELECT COUNT(*) FROM products WHERE stock = 0) AS out_of_stock,
        (SELECT COUNT(*) FROM returns WHERE status = 'Requested') AS pending_returns
    `)
  ]);
  return {
    totalRevenue: Number(rev.rows[0].revenue),
    totalOrders: Number(rev.rows[0].orders),
    totalUsers: Number(counts.rows[0].total_users),
    activeUsers: Number(counts.rows[0].active_users),
    sellers: Number(counts.rows[0].sellers),
    products: Number(counts.rows[0].products),
    lowStock: Number(counts.rows[0].low_stock),
    outOfStock: Number(counts.rows[0].out_of_stock),
    pendingReturns: Number(counts.rows[0].pending_returns)
  };
};

const listUsers = async () => {
  const { rows } = await query('SELECT * FROM users ORDER BY created_at DESC');
  return rows.map((r) => ({ ...publicUser(r), isActive: r.is_active, createdAt: r.created_at }));
};

const setUserActive = async (id, isActive) => {
  const { rows } = await query('UPDATE users SET is_active = $1 WHERE id = $2 RETURNING *', [!!isActive, Number(id)]);
  if (!rows.length) throw ApiError.notFound('User not found');
  return { ...publicUser(rows[0]), isActive: rows[0].is_active };
};

const categoryDistribution = async () => {
  const { rows } = await query(
    `SELECT c.name AS label, COUNT(p.id) AS value
     FROM categories c LEFT JOIN products p ON p.category_id = c.id
     GROUP BY c.name ORDER BY value DESC`
  );
  return rows.map((r) => ({ label: r.label, value: Number(r.value) }));
};

/** Recent transactions (charges + refunds) for the transactions report. */
const transactions = async () => {
  const { rows } = await query(
    `SELECT p.id, p.provider_ref, p.type, p.status, p.amount, p.currency, p.created_at, o.order_number, o.id AS order_id
     FROM payments p JOIN orders o ON o.id = p.order_id
     ORDER BY p.created_at DESC LIMIT 200`
  );
  return rows.map((r) => ({
    id: String(r.id), orderId: String(r.order_id), orderNumber: r.order_number, type: r.type, status: r.status,
    amount: Number(r.amount), currency: r.currency, reference: r.provider_ref || `TX-${r.id}`, date: r.created_at
  }));
};

/** Simple sales/inventory report series for charts. */
const reports = async () => {
  const { rows: sales } = await query(
    `SELECT
       to_char(date_trunc('day', o.placed_at), 'Dy') AS day,
       COUNT(DISTINCT o.id) AS orders,
       COALESCE(SUM(
         CASE
           WHEN p.type = 'charge' AND p.status = 'Paid' THEN p.amount
           WHEN p.type = 'refund' AND p.status = 'Paid' THEN -p.amount
           ELSE 0
         END
       ), 0) AS revenue
     FROM orders o
     LEFT JOIN payments p ON p.order_id = o.id
     WHERE o.placed_at > now() - interval '7 days' AND o.status <> 'Cancelled'
     GROUP BY 1 ORDER BY MIN(date_trunc('day', o.placed_at))`
  );
  const { rows: inventory } = await query(
    `SELECT
       c.name AS category,
       COALESCE(SUM(p.stock),0) AS stock,
       COUNT(p.id) AS products,
       COALESCE(SUM(CASE WHEN p.stock = 0 THEN 1 ELSE 0 END), 0) AS out_of_stock,
       COALESCE(SUM(CASE WHEN p.stock > 0 AND p.stock <= 20 THEN 1 ELSE 0 END), 0) AS low_stock
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     GROUP BY c.name ORDER BY c.name`
  );
  return {
    salesByDay: sales.map((r) => ({ day: r.day, orders: Number(r.orders), revenue: Number(r.revenue) })),
    inventoryByCategory: inventory.map((r) => ({
      category: r.category,
      stock: Number(r.stock),
      products: Number(r.products),
      outOfStock: Number(r.out_of_stock),
      lowStock: Number(r.low_stock)
    }))
  };
};

const createUser = async ({ name, email, password, role = 'customer', storeName, phone }) => {
  const validRoles = ['customer', 'seller', 'delivery', 'admin'];
  if (!validRoles.includes(role)) {
    throw ApiError.badRequest(`Role must be one of: ${validRoles.join(', ')}`);
  }
  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length) throw ApiError.conflict('An account with this email already exists');

  const hash = await bcrypt.hash(password, config.bcryptRounds);
  const effectiveStoreName = role === 'seller' ? (storeName?.trim() || `${name}'s Store`) : null;
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role, store_name, phone)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, role, store_name, phone, is_active, created_at`,
    [name, email.toLowerCase(), hash, role, effectiveStoreName, phone || null]
  );
  return { ...publicUser(rows[0]), isActive: rows[0].is_active, createdAt: rows[0].created_at };
};

module.exports = { stats, listUsers, setUserActive, createUser, categoryDistribution, transactions, reports };
