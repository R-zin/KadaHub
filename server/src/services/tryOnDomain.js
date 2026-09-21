const ApiError = require('../utils/ApiError');
const { query } = require('../db');
const tryOnService = require('./tryOnService');
const storageService = require('./storageService');

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
 * Generate + persist a try-on preview.
 * Verifies temporary image ownership and cleans up temporary files in an error-safe manner.
 */
const generate = async (userId, { productId, sourceImage, size = 'M', color = 'Original' }) => {
  if (!sourceImage) throw ApiError.badRequest('A source image is required');

  // Ownership verification: If sourceImage is a user-scoped temporary try-on image, ensure it belongs to the requesting user
  const tempMatch = sourceImage.match(/tryon_(\d+)__[a-f0-9-]+/i);
  if (tempMatch) {
    const ownerId = tempMatch[1];
    if (String(ownerId) !== String(userId)) {
      throw ApiError.forbidden('Access denied: You do not own this temporary image.');
    }
  }

  const isTemp = sourceImage.includes('tryon-temp') || /tryon_\d+__/i.test(sourceImage);

  try {
    const { rows } = await query(
      `SELECT p.*, COALESCE((SELECT json_agg(pi.url ORDER BY pi.sort_order) FROM product_images pi WHERE pi.product_id = p.id), '[]') AS images
       FROM products p WHERE p.id = $1`,
      [Number(productId)]
    );
    const product = rows[0];
    if (!product) throw ApiError.notFound('Product not found');

    const { previewImage } = await tryOnService.generatePreview({ product, sourceImage, size, color });

    const { rows: inserted } = await query(
      `INSERT INTO tryon_results (user_id, product_id, source_image, preview_image, size, color)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *, (SELECT name FROM products WHERE id = $2) AS product_name`,
      [userId, product.id, sourceImage, previewImage, size, color]
    );

    // Processing succeeded: clean up the temporary raw customer input asynchronously
    if (isTemp) {
      storageService.delete(sourceImage).catch(() => {});
    }

    return toResult(inserted[0]);
  } catch (err) {
    // Error-safe cleanup: If generation throws an exception, ensure the temporary file is deleted
    if (isTemp) {
      storageService.delete(sourceImage).catch(() => {});
    }
    throw err;
  }
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
