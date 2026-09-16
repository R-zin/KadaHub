const bcrypt = require('bcryptjs');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const { query } = require('../db');
const { signToken } = require('../middleware/auth');
const { notify } = require('./notificationService');

const publicUser = (row) => ({
  id: String(row.id),
  name: row.name,
  email: row.email,
  role: row.role,
  storeName: row.store_name || undefined,
  phone: row.phone || undefined
});

/** Register a new account. Seller accounts may supply a storefront name. */
const register = async ({ name, email, password, role = 'customer', storeName, phone }) => {
  const allowedRoles = ['customer', 'seller'];
  if (!allowedRoles.includes(role)) {
    throw ApiError.badRequest('Public registration is restricted to customer and seller accounts');
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length) throw ApiError.conflict('An account with this email already exists');

  const hash = await bcrypt.hash(password, config.bcryptRounds);
  const effectiveStoreName = role === 'seller' ? (storeName?.trim() || `${name}'s Store`) : null;
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role, store_name, phone)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, role, store_name, phone`,
    [name, email.toLowerCase(), hash, role, effectiveStoreName, phone || null]
  );
  const user = publicUser(rows[0]);
  await notify(rows[0].id, `Welcome to KadaHub, ${name}! Your ${role} account is ready.`);
  return { user, token: signToken(user) };
};

/** Log in with email + password. */
const login = async ({ email, password }) => {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  const row = rows[0];
  if (!row) throw ApiError.unauthorized('Invalid email or password');

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) throw ApiError.unauthorized('Invalid email or password');
  if (!row.is_active) throw ApiError.forbidden('This account has been deactivated');

  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [row.id]);
  const user = publicUser(row);
  return { user, token: signToken(user) };
};

/** Fetch the currently authenticated user's profile. */
const me = async (userId) => {
  const { rows } = await query('SELECT id, name, email, role, store_name, phone FROM users WHERE id = $1', [userId]);
  if (!rows.length) throw ApiError.notFound('User not found');
  return publicUser(rows[0]);
};

module.exports = { register, login, me, publicUser };
