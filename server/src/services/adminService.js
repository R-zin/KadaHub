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
        (SELECT COUNT(*) FROM users WHERE role = 'customer') AS customers,
        (SELECT COUNT(*) FROM users WHERE role = 'seller') AS sellers,
        (SELECT COUNT(*) FROM users WHERE role = 'delivery') AS delivery_agents,
        (SELECT COUNT(*) FROM users WHERE role = 'admin') AS admins,
        (SELECT COUNT(*) FROM products) AS products,
        (SELECT COUNT(*) FROM products WHERE stock > 0 AND stock <= 20) AS low_stock,
        (SELECT COUNT(*) FROM products WHERE stock = 0) AS out_of_stock,
        (SELECT COUNT(*) FROM returns) AS total_returns,
        (SELECT COUNT(*) FROM returns WHERE status = 'Requested') AS pending_returns,
        (SELECT COUNT(*) FROM payments WHERE type = 'refund' AND status = 'Paid') AS refunds,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE type = 'refund' AND status = 'Paid') AS refunded_amount
    `)
  ]);
  const c = counts.rows[0];
  return {
    totalRevenue: Number(rev.rows[0].revenue),
    totalOrders: Number(rev.rows[0].orders),
    totalUsers: Number(c.total_users),
    activeUsers: Number(c.active_users),
    customers: Number(c.customers),
    sellers: Number(c.sellers),
    deliveryAgents: Number(c.delivery_agents),
    admins: Number(c.admins),
    products: Number(c.products),
    lowStock: Number(c.low_stock),
    outOfStock: Number(c.out_of_stock),
    totalReturns: Number(c.total_returns),
    pendingReturns: Number(c.pending_returns),
    refunds: Number(c.refunds),
    refundedAmount: Number(c.refunded_amount)
  };
};

const listUsers = async () => {
  const { rows } = await query('SELECT * FROM users ORDER BY created_at DESC');
  return rows.map((r) => ({ ...publicUser(r), isActive: r.is_active, createdAt: r.created_at }));
};

const setUserActive = async (id, isActive, adminId) => {
  const numId = Number(id);
  if (isNaN(numId) || !Number.isInteger(numId) || numId <= 0) {
    throw ApiError.notFound('User not found');
  }
  if (adminId && numId === Number(adminId) && !isActive) {
    throw ApiError.badRequest('Cannot deactivate your own administrator account');
  }
  const { rows } = await query('UPDATE users SET is_active = $1 WHERE id = $2 RETURNING *', [!!isActive, numId]);
  if (!rows.length) throw ApiError.notFound('User not found');
  return { ...publicUser(rows[0]), isActive: rows[0].is_active };
};

const setUserRole = async (id, role, adminId) => {
  const numId = Number(id);
  if (isNaN(numId) || !Number.isInteger(numId) || numId <= 0) {
    throw ApiError.notFound('User not found');
  }
  const validRoles = ['customer', 'seller', 'delivery', 'admin'];
  if (!validRoles.includes(role)) {
    throw ApiError.badRequest(`Role must be one of: ${validRoles.join(', ')}`);
  }
  if (adminId && numId === Number(adminId) && role !== 'admin') {
    const { rows: adminCount } = await query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = TRUE");
    if (Number(adminCount[0].count) <= 1) {
      throw ApiError.badRequest('Cannot change the role of the only active administrator');
    }
  }
  const { rows } = await query('UPDATE users SET role = $1 WHERE id = $2 RETURNING *', [role, numId]);
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

/** Sales/inventory report series for charts with optional date range filtering. */
const reports = async (opts = {}) => {
  const where = ["o.status <> 'Cancelled'"];
  const params = [];

  if (opts.startDate || opts.endDate) {
    if (opts.startDate) {
      const start = new Date(opts.startDate);
      if (isNaN(start.getTime())) throw ApiError.badRequest('Invalid startDate format');
      params.push(start.toISOString());
      where.push(`o.placed_at >= $${params.length}`);
    }
    if (opts.endDate) {
      const end = new Date(opts.endDate);
      if (isNaN(end.getTime())) throw ApiError.badRequest('Invalid endDate format');
      params.push(end.toISOString());
      where.push(`o.placed_at <= $${params.length}`);
    }
    if (opts.startDate && opts.endDate) {
      if (new Date(opts.startDate) > new Date(opts.endDate)) {
        throw ApiError.badRequest('Invalid date range: startDate must be before or equal to endDate');
      }
    }
  } else {
    const days = Number(opts.days) > 0 ? Number(opts.days) : 7;
    params.push(days);
    where.push(`o.placed_at > now() - ($${params.length} || ' days')::interval`);
  }

  const { rows: sales } = await query(
    `SELECT
       to_char(date_trunc('day', o.placed_at), 'YYYY-MM-DD') AS date,
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
     WHERE ${where.join(' AND ')}
     GROUP BY 1, 2 ORDER BY MIN(date_trunc('day', o.placed_at))`,
    params
  );

  const { rows: inventory } = await query(
    `SELECT
       c.name AS category,
       COALESCE(SUM(p.stock), 0) AS stock,
       COUNT(p.id) AS products,
       COALESCE(SUM(CASE WHEN p.stock = 0 THEN 1 ELSE 0 END), 0) AS out_of_stock,
       COALESCE(SUM(CASE WHEN p.stock > 0 AND p.stock <= 20 THEN 1 ELSE 0 END), 0) AS low_stock
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     GROUP BY c.name ORDER BY c.name`
  );

  return {
    salesByDay: sales.map((r) => ({
      date: r.date,
      day: r.day,
      orders: Number(r.orders),
      revenue: Number(r.revenue)
    })),
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

module.exports = { stats, listUsers, setUserActive, setUserRole, createUser, categoryDistribution, transactions, reports };
