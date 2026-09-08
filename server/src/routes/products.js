const express = require('express');
const productService = require('../services/productService');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Public catalog
router.get('/', asyncH(async (req, res) => {
  res.json({ products: await productService.list(req.query) });
}));

router.get('/suggestions', asyncH(async (req, res) => {
  res.json({ suggestions: await productService.suggestions(req.query.q || '') });
}));

router.get('/:id', asyncH(async (req, res) => {
  res.json({ product: await productService.getById(req.params.id) });
}));

// Seller / admin product management
router.post('/', authenticate, authorize('seller', 'admin'), asyncH(async (req, res) => {
  const sellerId = req.user.role === 'admin' && req.body.sellerId ? Number(req.body.sellerId) : req.user.id;
  res.status(201).json({ product: await productService.create(sellerId, req.body) });
}));

router.put('/:id', authenticate, authorize('seller', 'admin'), asyncH(async (req, res) => {
  res.json({ product: await productService.update(req.params.id, req.body, req.user) });
}));

router.patch('/:id/stock', authenticate, authorize('seller', 'admin'), asyncH(async (req, res) => {
  res.json({ product: await productService.setStock(req.params.id, req.body.stock, req.user) });
}));

router.delete('/:id', authenticate, authorize('seller', 'admin'), asyncH(async (req, res) => {
  await productService.remove(req.params.id, req.user);
  res.status(204).end();
}));

module.exports = router;
