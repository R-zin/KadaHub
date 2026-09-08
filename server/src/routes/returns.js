const express = require('express');
const returnService = require('../services/returnService');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate);

router.post(
  '/',
  authorize('customer'),
  validate({ orderId: { required: true }, productId: { required: true }, reason: { required: true, type: 'string', max: 255 } }),
  asyncH(async (req, res) => res.status(201).json({ return: await returnService.request(req.user.id, req.body) }))
);

router.get('/', asyncH(async (req, res) => res.json({ returns: await returnService.listFor(req.user) })));

router.post('/:id/approve', authorize('admin'), asyncH(async (req, res) => res.json({ return: await returnService.approve(req.params.id, req.user) })));

router.post('/:id/reject', authorize('admin'), asyncH(async (req, res) => res.json({ return: await returnService.reject(req.params.id, req.user) })));

module.exports = router;
