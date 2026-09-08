const ApiError = require('../utils/ApiError');
const { query } = require('../db');
const tryOnService = require('./tryOnService');

const toResult = (row) => ({
  id: String(row.id),
  productId: String(row.product_id),
  productName: row.product_name,
  sourceImage: row.source_image,
  previewImage: row.preview_image,
  size: row.size,
  color: row.color,
  createdAt: row.created_at
});

/**
 * Generate + persist a try-on preview. `sourceImage` is a URL/path already
 * stored via the storage service (uploaded file) or a provided camera image URL.
 */
const generate = async (userId, { productId, sourceImage, size = 'M', color = 'Original' }) => {
  const { rows } = await query(
    `SELECT p.*, COALESCE((SELECT json_agg(pi.url ORDER BY pi.sort_order) FROM product_images pi WHERE pi.product_id = p.id), '[]') AS images
     FROM products p WHERE p.id = $1`,
    [Number(productId)]
  );
  const product = rows[0];
  if (!product) throw ApiError.notFound('Product not found');
  if (!sourceImage) throw ApiError.badRequest('A source image is required');

  const { previewImage } = await tryOnService.generatePreview({ product, sourceImage, size, color });

  const { rows: inserted } = await query(
    `INSERT INTO tryon_results (user_id, product_id, source_image, preview_image, size, color)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *, (SELECT name FROM products WHERE id = $2) AS product_name`,
    [userId, product.id, sourceImage, previewImage, size, color]
  );
  return toResult(inserted[0]);
};

const listFor = async (userId) => {
  const { rows } = await query(
    `SELECT t.*, p.name AS product_name FROM tryon_results t
     JOIN products p ON p.id = t.product_id WHERE t.user_id = $1 ORDER BY t.created_at DESC`,
    [userId]
  );
  return rows.map(toResult);
};

module.exports = { generate, listFor };
