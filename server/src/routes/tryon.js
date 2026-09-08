const express = require('express');
const tryOnDomain = require('../services/tryOnDomain');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate);

// Generate (and persist) a try-on preview for a supported product.
router.post(
  '/generate',
  validate({ productId: { required: true }, sourceImage: { required: true, type: 'string' }, size: { type: 'string' }, color: { type: 'string' } }),
  asyncH(async (req, res) => res.status(201).json({ result: await tryOnDomain.generate(req.user.id, req.body) }))
);

router.get('/', asyncH(async (req, res) => res.json({ results: await tryOnDomain.listFor(req.user.id) })));

module.exports = router;
