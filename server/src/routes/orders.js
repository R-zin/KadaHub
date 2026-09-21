const express = require('express');
const orderService = require('../services/orderService');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const paymentService = require('../services/paymentService');
const ApiError = require('../utils/ApiError');

const router = express.Router();
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate);

// Razorpay: create a server-verified order for checkout
router.post(
  '/razorpay/create-order',
  authorize('customer'),
  asyncH(async (req, res) => {
    const razorpayOrder = await orderService.createRazorpayOrder(req.user.id);
    res.status(201).json(razorpayOrder);
  })
);

// Payment verification endpoint (standalone verification check)
router.post(
  '/razorpay/verify-payment',
  authorize('customer'),
  validate({
    razorpay_order_id: { required: true },
    razorpay_payment_id: { required: true },
    razorpay_signature: { required: true }
  }),
  asyncH(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const verification = await paymentService.verifySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });
    if (!verification.valid) {
      throw ApiError.badRequest(verification.reason || 'Payment verification failed');
    }
    res.json({ verified: true });
  })
);

// Checkout: create an order from the current cart after a successful payment.
router.post(
  '/checkout',
  authorize('customer'),
  validate({
    address: { required: true },
    'address.name': {}, 'address.line1': {}
  }),
  asyncH(async (req, res) => {
    const order = await orderService.checkout(req.user.id, req.body.address, req.body.payment);
    res.status(201).json({ order });
  })
);

router.get('/', asyncH(async (req, res) => {
  const query = { ...req.query };
  if (req.user.role === 'seller') {
    query.sellerId = req.user.id;
  }
  res.json({ orders: await orderService.listFor(req.user, query) });
}));

router.get('/:id', asyncH(async (req, res) => res.json({ order: await orderService.getById(req.params.id, req.user) })));

// Delivery agent (or admin) advances the delivery status.
router.post(
  '/:id/advance',
  authorize('delivery', 'admin'),
  asyncH(async (req, res) => res.json({ order: await orderService.advanceStatus(req.params.id, req.user) }))
);

// Delivery agent claims an unassigned order
router.post(
  '/:id/claim',
  authorize('delivery'),
  asyncH(async (req, res) => res.json({ order: await orderService.claimDelivery(req.params.id, req.user) }))
);

// Admin assigns an order to a delivery agent
router.post(
  '/:id/assign',
  authorize('admin'),
  validate({ agentId: { required: true } }),
  asyncH(async (req, res) => res.json({ order: await orderService.assignDelivery(req.params.id, req.body.agentId) }))
);

module.exports = router;
