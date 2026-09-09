const express = require('express');
const wishlistService = require('../services/wishlistService');
const { authenticate } = require('../middleware/auth');
const asyncH = require('../utils/asyncHandler');

const router = express.Router();

router.use(authenticate);

router.get('/', asyncH(async (req, res) => res.json({ wishlist: await wishlistService.getIds(req.user.id) })));
router.post('/toggle/:productId', asyncH(async (req, res) => res.json({ wishlist: await wishlistService.toggle(req.user.id, req.params.productId) })));

module.exports = router;
