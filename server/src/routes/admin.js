const express = require('express');
const adminService = require('../services/adminService');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate, authorize('admin'));

router.get('/stats', asyncH(async (req, res) => res.json({ stats: await adminService.stats() })));
router.get('/users', asyncH(async (req, res) => res.json({ users: await adminService.listUsers() })));
router.patch('/users/:id/active', asyncH(async (req, res) => res.json({ user: await adminService.setUserActive(req.params.id, req.body.isActive) })));
router.get('/categories/distribution', asyncH(async (req, res) => res.json({ distribution: await adminService.categoryDistribution() })));
router.get('/transactions', asyncH(async (req, res) => res.json({ transactions: await adminService.transactions() })));
router.get('/reports', asyncH(async (req, res) => res.json(await adminService.reports())));

module.exports = router;
