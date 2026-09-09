const express = require('express');
const { query } = require('../db');
const asyncH = require('../utils/asyncHandler');

const router = express.Router();

// Public: full category tree with subcategories (matches the frontend Category type).
router.get('/', asyncH(async (req, res) => {
  const { rows } = await query(
    `SELECT c.id, c.name, c.slug, c.description, c.image, c.icon,
       COALESCE((SELECT json_agg(s.name ORDER BY s.name) FROM category_subcategories s WHERE s.category_id = c.id), '[]') AS subcategories
     FROM categories c ORDER BY c.id`
  );
  res.json({
    categories: rows.map((r) => ({
      id: String(r.id), name: r.name, slug: r.slug, description: r.description || '',
      image: r.image || '', icon: r.icon || '', subcategories: r.subcategories || []
    }))
  });
}));

module.exports = router;
