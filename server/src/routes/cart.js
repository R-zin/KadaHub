const express = require('express');
const cartService = require('../services/cartService');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate); // all cart routes require a logged-in user

router.get('/', asyncH(async (req, res) => res.json({ cart: await cartService.getCart(req.user.id) })));

router.post(
  '/items',
  validate({ productId: { required: true }, quantity: { type: 'number', min: 1 } }),
  asyncH(async (req, res) => res.status(201).json({ cart: await cartService.addItem(req.user.id, req.body.productId, req.body.quantity) }))
);

router.patch(
  '/items/:productId',
  validate({ quantity: { required: true, type: 'number' } }),
  asyncH(async (req, res) => res.json({ cart: await cartService.updateQuantity(req.user.id, req.params.productId, req.body.quantity) }))
);

router.delete('/items/:productId', asyncH(async (req, res) => res.json({ cart: await cartService.removeItem(req.user.id, req.params.productId) })));

router.delete('/', asyncH(async (req, res) => res.json({ cart: await cartService.clear(req.user.id) })));

module.exports = router;
