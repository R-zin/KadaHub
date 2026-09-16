const ApiError = require('../utils/ApiError');
const { query } = require('../db');

/** Map a joined product row (+images) to the API Product shape the frontend expects. */
const toProduct = (row) => ({
  id: String(row.id),
  name: row.name,
  description: row.description || '',
  price: Number(row.price),
  originalPrice: row.original_price != null ? Number(row.original_price) : undefined,
  discount: row.discount != null ? Number(row.discount) : undefined,
  category: row.category_name,
  subcategory: row.subcategory || '',
  brand: row.brand || '',
  images: row.images || [],
  rating: row.rating != null ? Number(row.rating) : 0,
  reviewCount: row.review_count != null ? Number(row.review_count) : 0,
  stock: Number(row.stock),
  sellerId: String(row.seller_id),
  sellerName: row.seller_name || '',
  specifications: row.specifications || {},
  tags: row.tags || [],
  isFeatured: !!row.is_featured,
  isNew: !!row.is_new,
  isBestSeller: !!row.is_best_seller,
  isVirtualTryOnSupported: !!row.is_virtual_try_on_supported,
  productType: row.product_type || ''
});

const BASE_SELECT = `
  SELECT p.*, c.name AS category_name, u.store_name AS seller_name,
    COALESCE((
      SELECT json_agg(pi.url ORDER BY pi.sort_order, pi.id)
      FROM product_images pi WHERE pi.product_id = p.id
    ), '[]') AS images
  FROM products p
  JOIN categories c ON c.id = p.category_id
  JOIN users u ON u.id = p.seller_id
`;

/** List/filter/search products. options: { search, category, subcategory, brand, minPrice, maxPrice, minRating, availability, sort, sellerId } */
const list = async (opts = {}) => {
  const where = [];
  const params = [];
  const add = (clause, value) => { params.push(value); where.push(clause.replace('$$', `$${params.length}`)); };

  const search = (opts.search || opts.q || '').trim();
  if (search) {
    params.push(search);
    const i = params.length;
    where.push(`(p.search_tsv @@ plainto_tsquery('english', $${i})
      OR p.name ILIKE '%' || $${i} || '%' OR p.description ILIKE '%' || $${i} || '%'
      OR p.brand ILIKE '%' || $${i} || '%' OR p.subcategory ILIKE '%' || $${i} || '%'
      OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(p.tags, '[]'::jsonb)) t WHERE t ILIKE '%' || $${i} || '%'))`);
  }
  if (opts.category) {
    params.push(opts.category);
    const i = params.length;
    where.push(`(c.slug = LOWER($${i}) OR c.name ILIKE $${i})`);
  }
  if (opts.subcategory) add('p.subcategory ILIKE $$', opts.subcategory);
  if (opts.brand) add('p.brand = $$', opts.brand);
  if (opts.minPrice != null) add('p.price >= $$', Number(opts.minPrice));
  if (opts.maxPrice != null) add('p.price <= $$', Number(opts.maxPrice));
  if (opts.minRating != null) add('p.rating >= $$', Number(opts.minRating));
  if (opts.availability === 'in-stock') where.push('p.stock > 0');
  if (opts.availability === 'out-of-stock') where.push('p.stock = 0');
  if (opts.sellerId) add('p.seller_id = $$', Number(opts.sellerId));

  const orderBy = {
    'price-asc': 'p.price ASC',
    'price-desc': 'p.price DESC',
    rating: 'p.rating DESC',
    newest: 'p.is_new DESC, p.id DESC',
    popular: 'p.review_count DESC',
    relevance: 'p.is_featured DESC, p.rating DESC'
  }[opts.sort] || 'p.is_featured DESC, p.rating DESC';

  let sql = `${BASE_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${orderBy}`;
  const limit = Math.min(Number(opts.limit) || 0, 100);
  if (limit > 0) {
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
  }
  const { rows } = await query(sql, params);
  return rows.map(toProduct);
};

const getById = async (id) => {
  const { rows } = await query(`${BASE_SELECT} WHERE p.id = $1`, [Number(id)]);
  if (!rows.length) throw ApiError.notFound('Product not found');
  return toProduct(rows[0]);
};

/** Create a product (seller). Only Clothing may be flagged try-on. */
const create = async (sellerId, data) => {
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    throw ApiError.badRequest('Product name is required');
  }
  if (data.price == null || isNaN(Number(data.price)) || Number(data.price) < 0) {
    throw ApiError.badRequest('Valid price (>= 0) is required');
  }
  const stock = Number(data.stock || 0);
  if (isNaN(stock) || !Number.isInteger(stock) || stock < 0) {
    throw ApiError.badRequest('Stock must be a non-negative integer');
  }
  const discount = data.discount != null ? Number(data.discount) : 0;
  if (isNaN(discount) || discount < 0 || discount > 100) {
    throw ApiError.badRequest('Discount must be between 0 and 100');
  }

  const cat = await categoryByNameOrSlug(data.category);
  const canonicalSubcategory = data.subcategory
    ? await validateSubcategory(cat.id, cat.name, data.subcategory)
    : null;
  const isTryOn = cat.name === 'Clothing' && !!data.isVirtualTryOnSupported;

  const { rows } = await query(
    `INSERT INTO products
       (seller_id, category_id, subcategory, name, description, price, original_price, discount,
        brand, stock, specifications, tags, is_featured, is_new, is_best_seller,
        is_virtual_try_on_supported, product_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING id`,
    [
      sellerId, cat.id, canonicalSubcategory, data.name.trim(), data.description || '',
      Number(data.price), data.originalPrice != null ? Number(data.originalPrice) : null,
      discount, data.brand || null,
      stock, JSON.stringify(data.specifications || {}),
      JSON.stringify(Array.isArray(data.tags) ? data.tags : []), !!data.isFeatured, !!data.isNew, !!data.isBestSeller,
      isTryOn, data.productType || null
    ]
  );
  const id = rows[0].id;
  await saveImages(id, data.images);
  return getById(id);
};

/** Update a product the seller owns (or any product for admin). */
const update = async (id, data, actor) => {
  const existing = await rawById(id);
  if (actor.role !== 'admin' && existing.seller_id !== actor.id) {
    throw ApiError.forbidden('You can only edit your own products');
  }

  if (data.name !== undefined && (!data.name || typeof data.name !== 'string' || !data.name.trim())) {
    throw ApiError.badRequest('Product name cannot be empty');
  }
  if (data.price !== undefined && (isNaN(Number(data.price)) || Number(data.price) < 0)) {
    throw ApiError.badRequest('Valid price (>= 0) is required');
  }
  if (data.stock !== undefined) {
    const stock = Number(data.stock);
    if (isNaN(stock) || !Number.isInteger(stock) || stock < 0) {
      throw ApiError.badRequest('Stock must be a non-negative integer');
    }
  }
  if (data.discount !== undefined) {
    const discount = Number(data.discount);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      throw ApiError.badRequest('Discount must be between 0 and 100');
    }
  }

  const cat = data.category
    ? await categoryByNameOrSlug(data.category)
    : { id: existing.category_id, name: existing.category_name };

  let canonicalSubcategory = undefined;
  if (data.subcategory !== undefined) {
    canonicalSubcategory = data.subcategory
      ? await validateSubcategory(cat.id, cat.name, data.subcategory)
      : null;
  } else if (data.category && existing.subcategory) {
    canonicalSubcategory = await validateSubcategory(cat.id, cat.name, existing.subcategory);
  }

  const categoryName = cat.name;
  const isTryOn = categoryName === 'Clothing' &&
    (data.isVirtualTryOnSupported !== undefined ? !!data.isVirtualTryOnSupported : existing.is_virtual_try_on_supported);

  const fields = {
    subcategory: canonicalSubcategory,
    name: data.name ? data.name.trim() : undefined,
    description: data.description,
    price: data.price != null ? Number(data.price) : undefined,
    original_price: data.originalPrice != null ? Number(data.originalPrice) : undefined,
    discount: data.discount != null ? Number(data.discount) : undefined,
    brand: data.brand,
    stock: data.stock != null ? Number(data.stock) : undefined,
    specifications: data.specifications ? JSON.stringify(data.specifications) : undefined,
    tags: data.tags ? JSON.stringify(data.tags) : undefined,
    is_featured: data.isFeatured,
    is_new: data.isNew,
    is_best_seller: data.isBestSeller,
    is_virtual_try_on_supported: isTryOn,
    product_type: data.productType
  };
  const sets = [];
  const params = [];
  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined) { params.push(val); sets.push(`${col} = $${params.length}`); }
  }
  if (data.category) {
    params.push(cat.id);
    sets.push(`category_id = $${params.length}`);
  }
  if (sets.length) {
    params.push(Number(id));
    await query(`UPDATE products SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params);
  }
  if (data.images) await saveImages(id, data.images, true);
  return getById(id);
};

const remove = async (id, actor) => {
  const existing = await rawById(id);
  if (actor.role !== 'admin' && existing.seller_id !== actor.id) {
    throw ApiError.forbidden('You can only delete your own products');
  }
  const { rows: orderRefs } = await query(
    'SELECT 1 FROM order_items WHERE product_id = $1 UNION SELECT 1 FROM returns WHERE product_id = $1 LIMIT 1',
    [Number(id)]
  );
  if (orderRefs.length > 0) {
    throw ApiError.badRequest('Cannot delete a product with existing order history. Please set its stock to 0 to delist it.');
  }
  await query('DELETE FROM products WHERE id = $1', [Number(id)]);
};

/** Update just the stock level (seller inventory management). */
const setStock = async (id, stock, actor) => {
  const parsedStock = Number(stock);
  if (isNaN(parsedStock) || !Number.isInteger(parsedStock) || parsedStock < 0) {
    throw ApiError.badRequest('Stock must be a non-negative integer');
  }
  const existing = await rawById(id);
  if (actor.role !== 'admin' && existing.seller_id !== actor.id) {
    throw ApiError.forbidden('You can only manage your own inventory');
  }
  await query('UPDATE products SET stock = $1, updated_at = now() WHERE id = $2', [parsedStock, Number(id)]);
  return getById(id);
};

// ---- helpers ---------------------------------------------------------------

const rawById = async (id) => {
  const { rows } = await query(`${BASE_SELECT} WHERE p.id = $1`, [Number(id)]);
  if (!rows.length) throw ApiError.notFound('Product not found');
  return rows[0];
};

const categoryByNameOrSlug = async (nameOrSlug) => {
  if (!nameOrSlug || typeof nameOrSlug !== 'string' || !nameOrSlug.trim()) {
    throw ApiError.badRequest('Category is required');
  }
  const { rows } = await query(
    'SELECT * FROM categories WHERE LOWER(slug) = LOWER($1) OR LOWER(name) = LOWER($1)',
    [nameOrSlug.trim()]
  );
  if (!rows.length) throw ApiError.badRequest(`Unknown category: ${nameOrSlug}`);
  return rows[0];
};

const validateSubcategory = async (categoryId, categoryName, subcategory) => {
  if (!subcategory || typeof subcategory !== 'string' || !subcategory.trim()) return null;
  const trimmed = subcategory.trim();
  const { rows } = await query(
    'SELECT name FROM category_subcategories WHERE category_id = $1 AND (LOWER(name) = LOWER($2) OR name ILIKE $2)',
    [categoryId, trimmed]
  );
  if (!rows.length) {
    throw ApiError.badRequest(`Subcategory "${trimmed}" is not valid for category "${categoryName}"`);
  }
  return rows[0].name;
};

const saveImages = async (productId, images, replace = false) => {
  if (!Array.isArray(images) || !images.length) return;
  if (replace) await query('DELETE FROM product_images WHERE product_id = $1', [Number(productId)]);
  const values = images.map((url, i) => `($1, $${i + 2}, ${i})`).join(', ');
  const params = [Number(productId), ...images];
  await query(`INSERT INTO product_images (product_id, url, sort_order) VALUES ${values}`, params);
};

/** Short suggestions for the search box. */
const suggestions = async (q) => {
  if (!q || !q.trim()) return [];
  const { rows } = await query(
    `${BASE_SELECT} WHERE p.name ILIKE '%' || $1 || '%' ORDER BY p.rating DESC LIMIT 6`,
    [q.trim()]
  );
  return rows.map((r) => ({ id: String(r.id), label: r.name, meta: `${r.brand || ''} · ${r.category_name}` }));
};

module.exports = { list, getById, create, update, remove, setStock, suggestions, toProduct };
