const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// Throttle credential endpoints against brute force.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Please try again later.', status: 429 } }
});

router.post(
  '/register',
  authLimiter,
  validate({
    name: { required: true, type: 'string', max: 120 },
    email: { required: true, type: 'email' },
    password: { required: true, type: 'string' },
    role: { type: 'string', enum: ['customer', 'seller', 'delivery', 'admin'] },
    storeName: { type: 'string', max: 120 },
    phone: { type: 'string', max: 40 }
  }),
  authController.register
);

router.post(
  '/login',
  authLimiter,
  validate({ email: { required: true, type: 'email' }, password: { required: true, type: 'string' } }),
  authController.login
);

router.get('/me', authenticate, authController.me);

module.exports = router;
