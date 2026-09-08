const { query } = require('../db');

/** Return the wishlist as an array of product ids (order preserved by added_at). */
const getIds = async (userId) => {
  const { rows } = await query('SELECT product_id FROM wishlist_items WHERE user_id = $1 ORDER BY added_at', [userId]);
  return rows.map((r) => String(r.product_id));
};

/** Toggle a product in/out of the wishlist. Returns the fresh list of ids. */
const toggle = async (userId, productId) => {
  const { rows } = await query('SELECT 1 FROM wishlist_items WHERE user_id = $1 AND product_id = $2', [userId, Number(productId)]);
  if (rows.length) {
    await query('DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2', [userId, Number(productId)]);
  } else {
    await query('INSERT INTO wishlist_items (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, Number(productId)]);
  }
  return getIds(userId);
};

module.exports = { getIds, toggle };
