const express = require('express');
const crypto = require('crypto');
const config = require('../config');
const { query } = require('../db');

const router = express.Router();

// Razorpay Webhook listener (Section 15)
router.post('/razorpay/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expected = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      const expectedBuf = Buffer.from(expected, 'utf8');
      const sigBuf = Buffer.from(String(signature), 'utf8');
      if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
        return res.status(400).json({ error: { message: 'Invalid webhook signature' } });
      }
    }

    const event = req.body?.event;
    if (event === 'payment.captured' && req.body?.payload?.payment?.entity) {
      const paymentEntity = req.body.payload.payment.entity;
      await query(
        `UPDATE payments SET status = 'Paid', updated_at = now() WHERE provider_ref = $1`,
        [paymentEntity.id]
      ).catch(() => {});
    }

    res.status(200).json({ status: 'ok', received: true });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

module.exports = router;
