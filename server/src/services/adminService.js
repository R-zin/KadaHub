const ApiError = require('../utils/ApiError');
const { query } = require('../db');
const { publicUser } = require('./authDomain');

/** Aggregate dashboard stats for the admin overview. */
const stats = async () => {
  const [rev, counts] = await Promise.all([
    query(`SELECT COALESCE(SUM(total),0) AS revenue, COUNT(*) AS orders FROM orders WHERE status <> 'Cancelled'`),
    query(`SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM users WHERE role = 'seller') AS sellers,
      (SELECT COUNT(*) FROM products) AS products,
      (SELECT COUNT(*) FROM products WHERE stock > 0 AND stock <= 20) AS low_stock,
      (SELECT COUNT(*) FROM returns WHERE status NOT IN ('Refunded','Rejected')) AS pending_returns`)
  ]);
  return {
    totalRevenue: Number(rev.rows[0].revenue),
    totalOrders: Number(rev.rows[0].orders),
    activeUsers: Number(counts.rows[0].users),
    sellers: Number(counts.rows[0].sellers),
    products: Number(counts.rows[0].products),
    lowStock: Number(counts.rows[0].low_stock),
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
    `SELECT p.id, p.provider_ref, p.type, p.status, p.amount, p.currency, p.created_at, o.order_number
     FROM payments p JOIN orders o ON o.id = p.order_id
     ORDER BY p.created_at DESC LIMIT 200`
  );
  return rows.map((r) => ({
    id: String(r.id), orderNumber: r.order_number, type: r.type, status: r.status,
    amount: Number(r.amount), currency: r.currency, reference: r.provider_ref, date: r.created_at
  }));
};

/** Simple sales/inventory report series for charts. */
const reports = async () => {
  const { rows: sales } = await query(
    `SELECT to_char(date_trunc('day', placed_at), 'Dy') AS day, COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue
     FROM orders WHERE placed_at > now() - interval '7 days' AND status <> 'Cancelled'
     GROUP BY 1 ORDER BY MIN(date_trunc('day', placed_at))`
  );
  const { rows: inventory } = await query(
    `SELECT c.name AS category, COALESCE(SUM(p.stock),0) AS stock, COUNT(p.id) AS products
     FROM categories c LEFT JOIN products p ON p.category_id = c.id GROUP BY c.name ORDER BY c.name`
  );
  return {
    salesByDay: sales.map((r) => ({ day: r.day, orders: Number(r.orders), revenue: Number(r.revenue) })),
    inventoryByCategory: inventory.map((r) => ({ category: r.category, stock: Number(r.stock), products: Number(r.products) }))
  };
};

module.exports = { stats, listUsers, setUserActive, categoryDistribution, transactions, reports };
