const express = require('express');
const notificationDomain = require('../services/notificationDomain');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate);

router.get('/', asyncH(async (req, res) => res.json({ notifications: await notificationDomain.listFor(req.user.id) })));
router.post('/read-all', asyncH(async (req, res) => res.json({ notifications: await notificationDomain.markAllRead(req.user.id) })));
router.delete('/:id', asyncH(async (req, res) => res.json({ notifications: await notificationDomain.dismiss(req.user.id, req.params.id) })));

module.exports = router;
