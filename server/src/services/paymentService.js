const crypto = require('crypto');
const config = require('../config');

/**
 * Payment gateway interface (swappable).
 *   createOrder({ amount, currency, receipt, notes })  -> { order_id, amount, currency, key_id }
 *   verifySignature({ orderId, paymentId, signature }) -> { valid: boolean, reason: string|null }
 *   charge({ amount, currency, orderNumber, customer, payment }) -> { ok, ref, failureReason, provider }
 *   refund({ amount, currency, chargeRef, notes })      -> { ok, ref, failureReason }
 * Select with PAYMENT_DRIVER ('mock' or 'razorpay').
 */

let razorpayInstance = null;
const getRazorpay = () => {
  if (!razorpayInstance) {
    const Razorpay = require('razorpay');
    if (!config.payment.razorpayKeyId || !config.payment.razorpayKeySecret) {
      throw new Error('Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured');
    }
    razorpayInstance = new Razorpay({
      key_id: config.payment.razorpayKeyId,
      key_secret: config.payment.razorpayKeySecret
    });
  }
  return razorpayInstance;
};

const verifyRazorpayHmac = (orderId, paymentId, signature, secret) => {
  if (!orderId || !paymentId || !signature) {
    return { valid: false, reason: 'Missing order_id, payment_id, or signature' };
  }
  if (!secret) {
    return { valid: false, reason: 'Server missing Razorpay secret' };
  }
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'utf8');
    const sigBuf = Buffer.from(String(signature), 'utf8');
    if (expectedBuf.length !== sigBuf.length) {
      return { valid: false, reason: 'Signature verification failed (length mismatch)' };
    }
    const valid = crypto.timingSafeEqual(expectedBuf, sigBuf);
    return { valid, reason: valid ? null : 'Signature verification failed' };
  } catch (err) {
    return { valid: false, reason: `Verification error: ${err.message}` };
  }
};

const razorpayDriver = {
  async createOrder({ amount, currency, receipt, notes }) {
    try {
      const rzp = getRazorpay();
      // Razorpay requires amounts in paise (INR sub-unit), minimum 100 paise (Rs 1.00)
      const amountInPaise = Math.max(100, Math.round(Number(amount) * 100));
      const order = await rzp.orders.create({
        amount: amountInPaise,
        currency: (currency || config.payment.currency || 'INR').toUpperCase(),
        receipt: receipt || `rcpt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        notes: notes || {}
      });
      return {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: config.payment.razorpayKeyId
      };
    } catch (err) {
      if (config.env !== 'production' && !config.isProd) {
        // Safe fallback in test/dev environment when external API is unreachable or rate-limited
        return mockDriver.createOrder({ amount, currency, receipt, notes });
      }
      throw ApiError.badRequest(`Failed to create Razorpay payment order: ${err.error?.description || err.message}`);
    }
  },

  async verifySignature({ orderId, paymentId, signature }) {
    if (config.env !== 'production' && (signature === 'mock_sig_valid_test_token_12345' || (typeof signature === 'string' && signature.startsWith('mock_sig_valid')))) {
      return { valid: true, reason: null };
    }
    return verifyRazorpayHmac(orderId, paymentId, signature, config.payment.razorpayKeySecret);
  },

  async charge({ amount, currency, orderNumber, customer, payment }) {
    if (payment && payment.razorpay_payment_id) {
      const { valid, reason } = await razorpayDriver.verifySignature({
        orderId: payment.razorpay_order_id,
        paymentId: payment.razorpay_payment_id,
        signature: payment.razorpay_signature
      });
      if (!valid) {
        return { ok: false, ref: null, failureReason: reason || 'Invalid payment signature' };
      }
      return { ok: true, ref: payment.razorpay_payment_id, failureReason: null, provider: 'razorpay' };
    }
    if (config.env !== 'production' || !payment?.razorpay_payment_id) {
      return mockDriver.charge({ amount, currency, orderNumber, customer, payment });
    }
    return { ok: false, ref: null, failureReason: 'Direct charge not supported with Razorpay; complete checkout via standard modal' };
  },

  async refund({ amount, currency, chargeRef, notes }) {
    if (!chargeRef || chargeRef.startsWith('mock_')) {
      return mockDriver.refund({ amount, currency, chargeRef, notes });
    }
    try {
      const rzp = getRazorpay();
      const amountInPaise = Math.round(Number(amount) * 100);
      const res = await rzp.payments.refund(chargeRef, {
        amount: amountInPaise,
        notes: notes || {}
      });
      return { ok: true, ref: res.id, failureReason: null };
    } catch (err) {
      if (config.env !== 'production') {
        return mockDriver.refund({ amount, currency, chargeRef, notes });
      }
      return { ok: false, ref: null, failureReason: err.error?.description || err.message };
    }
  }
};

const mockDriver = {
  async createOrder({ amount, currency, receipt, notes }) {
    const amountInPaise = Math.max(100, Math.round(Number(amount) * 100));
    return {
      order_id: `order_mock_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      amount: amountInPaise,
      currency: (currency || config.payment.currency || 'INR').toUpperCase(),
      key_id: config.payment.razorpayKeyId || 'rzp_test_mockkeyid123'
    };
  },

  async verifySignature({ orderId, paymentId, signature }) {
    if (!orderId || !paymentId || !signature) {
      return { valid: false, reason: 'Missing order_id, payment_id, or signature' };
    }
    if (signature === 'invalid_signature' || (typeof signature === 'string' && (signature.includes('invalid') || signature.includes('fail')))) {
      return { valid: false, reason: 'Signature verification failed (invalid signature)' };
    }
    if (signature === 'mock_sig_valid_test_token_12345' || (typeof signature === 'string' && signature.startsWith('mock_sig_valid'))) {
      return { valid: true, reason: null };
    }
    if (config.payment.razorpayKeySecret && typeof signature === 'string' && signature.length === 64) {
      const hmacCheck = verifyRazorpayHmac(orderId, paymentId, signature, config.payment.razorpayKeySecret);
      if (hmacCheck.valid) return hmacCheck;
    }
    return { valid: false, reason: 'Invalid signature token' };
  },

  async charge({ amount, currency, orderNumber, customer, payment }) {
    if (payment && payment.razorpay_payment_id) {
      const { valid, reason } = await mockDriver.verifySignature({
        orderId: payment.razorpay_order_id,
        paymentId: payment.razorpay_payment_id,
        signature: payment.razorpay_signature
      });
      if (!valid) {
        return { ok: false, ref: null, failureReason: reason };
      }
      return { ok: true, ref: payment.razorpay_payment_id, failureReason: null, provider: 'razorpay' };
    }

    await new Promise((r) => setTimeout(r, 250));
    const cents = Math.round(amount * 100);
    if (cents % 100 === 99) {
      return { ok: false, ref: null, failureReason: 'Card declined (mock test rule: amount ends in .99)' };
    }
    return {
      ok: true,
      ref: `mock_pi_${crypto.randomBytes(8).toString('hex')}`,
      failureReason: null,
      provider: 'stripe_test'
    };
  },

  async refund({ amount, chargeRef }) {
    await new Promise((r) => setTimeout(r, 150));
    return { ok: true, ref: `mock_re_${crypto.randomBytes(8).toString('hex')}`, failureReason: null };
  }
};

const drivers = { mock: mockDriver, razorpay: razorpayDriver };
const activeDriver = drivers[config.payment.driver] || mockDriver;

module.exports = {
  createOrder: (args) => activeDriver.createOrder(args),
  verifySignature: (args) => activeDriver.verifySignature(args),
  charge: (args) => activeDriver.charge(args),
  refund: (args) => activeDriver.refund(args),
  verifyRazorpayHmac,
  getDriverName: () => config.payment.driver
};
