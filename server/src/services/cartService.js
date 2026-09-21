const ApiError = require('../utils/ApiError');
const { query } = require('../db');

const toCartItem = (row) => ({
  quantity: row.quantity,
  product: {
    id: String(row.id), name: row.name, description: row.description || '',
    price: Number(row.price), originalPrice: row.original_price != null ? Number(row.original_price) : undefined,
    discount: row.discount != null ? Number(row.discount) : undefined,
    category: row.category_name, subcategory: row.subcategory || '', brand: row.brand || '',
    images: row.images || [], rating: Number(row.rating || 0), reviewCount: Number(row.review_count || 0),
    stock: Number(row.stock), sellerId: String(row.seller_id), sellerName: row.seller_name || '',
    specifications: row.specifications || {}, tags: row.tags || [],
    isFeatured: !!row.is_featured, isNew: !!row.is_new, isBestSeller: !!row.is_best_seller,
    isVirtualTryOnSupported: !!row.is_virtual_try_on_supported, productType: row.product_type || ''
  }
});

const CART_SELECT = `
  SELECT ci.quantity, p.*, c.name AS category_name, u.store_name AS seller_name,
    COALESCE((SELECT json_agg(pi.url ORDER BY pi.sort_order) FROM product_images pi WHERE pi.product_id = p.id), '[]') AS images
  FROM cart_items ci
  JOIN products p ON p.id = ci.product_id
  JOIN categories c ON c.id = p.category_id
  JOIN users u ON u.id = p.seller_id
`;

const getCart = async (userId) => {
  const { rows } = await query(`${CART_SELECT} WHERE ci.user_id = $1 ORDER BY ci.added_at`, [userId]);
  return rows.map(toCartItem);
};

const parseProductId = (productId) => {
  const numId = Number(productId);
  if (isNaN(numId) || !Number.isInteger(numId) || numId <= 0) {
    throw ApiError.badRequest('Invalid product ID');
  }
  return numId;
};

const parseQuantity = (quantity, allowZero = false) => {
  const num = Number(quantity);
  if (isNaN(num) || !Number.isInteger(num) || (allowZero ? num < 0 : num <= 0)) {
    throw ApiError.badRequest(allowZero ? 'Quantity must be a non-negative integer' : 'Quantity must be a positive integer');
  }
  return num;
};

/** Add (or increment) an item, capped at available stock. */
const addItem = async (userId, productId, quantity = 1) => {
  const numProdId = parseProductId(productId);
  const numQty = parseQuantity(quantity);
  const { rows } = await query('SELECT stock, name FROM products WHERE id = $1', [numProdId]);
  const product = rows[0];
  if (!product) throw ApiError.notFound('Product not found');
  if (product.stock <= 0) throw ApiError.conflict(`"${product.name}" is out of stock`);

  await query(
    `INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1,$2, LEAST($3::int, $4::int))
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, $4::int)`,
    [userId, numProdId, numQty, product.stock]
  );
  return getCart(userId);
};

const updateQuantity = async (userId, productId, quantity) => {
  const numProdId = parseProductId(productId);
  const numQty = parseQuantity(quantity, true);
  if (numQty === 0) return removeItem(userId, numProdId);
  const { rows } = await query('SELECT stock, name FROM products WHERE id = $1', [numProdId]);
  if (!rows.length) throw ApiError.notFound('Product not found');
  if (rows[0].stock <= 0) {
    await removeItem(userId, numProdId);
    throw ApiError.conflict(`"${rows[0].name}" is out of stock`);
  }
  const qty = Math.min(numQty, rows[0].stock);
  await query('UPDATE cart_items SET quantity = $1 WHERE user_id = $2 AND product_id = $3', [qty, userId, numProdId]);
  return getCart(userId);
};

const removeItem = async (userId, productId) => {
  const numProdId = parseProductId(productId);
  await query('DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2', [userId, numProdId]);
  return getCart(userId);
};

const clear = async (userId) => {
  await query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
  return [];
};

module.exports = { getCart, addItem, updateQuantity, removeItem, clear };
