const express = require('express');
const adminService = require('../services/adminService');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate, authorize('admin'));

router.get('/stats', asyncH(async (req, res) => res.json({ stats: await adminService.stats() })));
router.get('/users', asyncH(async (req, res) => res.json({ users: await adminService.listUsers() })));
router.post(
  '/users',
  validate({
    name: { required: true, type: 'string', max: 120 },
    email: { required: true, type: 'email' },
    password: { required: true, type: 'string' },
    role: { required: true, type: 'string', enum: ['customer', 'seller', 'delivery', 'admin'] },
    storeName: { type: 'string', max: 120 },
    phone: { type: 'string', max: 40 }
  }),
  asyncH(async (req, res) => res.status(201).json({ user: await adminService.createUser(req.body) }))
);
router.patch('/users/:id/active', asyncH(async (req, res) => res.json({ user: await adminService.setUserActive(req.params.id, req.body.isActive) })));
router.get('/categories/distribution', asyncH(async (req, res) => res.json({ distribution: await adminService.categoryDistribution() })));
router.get('/transactions', asyncH(async (req, res) => res.json({ transactions: await adminService.transactions() })));
router.get('/reports', asyncH(async (req, res) => res.json(await adminService.reports())));

module.exports = router;
