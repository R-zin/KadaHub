const jwt = require('jsonwebtoken');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const { query } = require('../db');

/**
 * Authenticate: verify the Bearer JWT and attach a fresh `req.user`.
 * The token is re-issued (sliding expiration) on each authenticated call so a
 * user is logged out only after 15 minutes of *inactivity*, not 15 min after login.
 */
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw ApiError.unauthorized('Missing or malformed Authorization header');

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch (e) {
      throw ApiError.unauthorized('Session expired. Please log in again.');
    }

    const { rows } = await query(
      'SELECT id, name, email, role, store_name AS "storeName", is_active AS "isActive" FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = rows[0];
    if (!user) throw ApiError.unauthorized('Account no longer exists');
    if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

    req.user = user;

    // Sliding session: hand back a fresh token so the client stays logged in
    // while active, but is logged out after JWT_EXPIRES_IN of inactivity.
    const fresh = jwt.sign({ sub: user.id, role: user.role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn
    });
    res.set('X-Refresh-Token', fresh);

    next();
  } catch (err) {
    next(err);
  }
};

/** Authorize: require one of the given roles. Use after authenticate. */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden(`Requires one of: ${roles.join(', ')}`));
  }
  next();
};

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

module.exports = { authenticate, authorize, signToken };
