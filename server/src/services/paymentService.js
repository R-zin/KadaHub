const config = require('../config');
const crypto = require('crypto');

/**
 * Payment gateway interface (swappable).
 *   charge({ amount, currency, orderNumber, customer }) -> { ok, ref, failureReason }
 *   refund({ amount, currency, chargeRef })             -> { ok, ref, failureReason }
 * Select with PAYMENT_DRIVER. 'mock' emulates a Stripe-test-mode-style gateway.
 */

const mockDriver = {
  async charge({ amount, currency, orderNumber }) {
    // Simulate network + processing latency of a real gateway call.
    await new Promise((r) => setTimeout(r, 300));
    // Deterministic test hook: a whole-dollar amount ending in .99 fails,
    // so tests can exercise the failure path without a real gateway.
    const cents = Math.round(amount * 100);
    if (cents % 100 === 99) {
      return { ok: false, ref: null, failureReason: 'Card declined (mock test rule: amount ends in .99)' };
    }
    return {
      ok: true,
      ref: `mock_pi_${crypto.randomBytes(8).toString('hex')}`,
      failureReason: null
    };
  },
  async refund({ amount, chargeRef }) {
    await new Promise((r) => setTimeout(r, 200));
    return { ok: true, ref: `mock_re_${crypto.randomBytes(8).toString('hex')}`, failureReason: null };
  }
};

// Real Stripe driver (test mode). Uncomment and `npm i stripe` to enable.
// const stripeDriver = {
//   async charge({ amount, currency, orderNumber }) {
//     const stripe = require('stripe')(config.payment.stripeSecretKey);
//     try {
//       const pi = await stripe.paymentIntents.create({
//         amount: Math.round(amount * 100), currency, description: `Order ${orderNumber}`,
//         automatic_payment_methods: { enabled: true }
//       });
//       return { ok: true, ref: pi.id, failureReason: null };
//     } catch (e) {
//       return { ok: false, ref: null, failureReason: e.message };
//     }
//   },
//   async refund({ amount, chargeRef }) {
//     const stripe = require('stripe')(config.payment.stripeSecretKey);
//     const re = await stripe.refunds.create({ payment_intent: chargeRef, amount: Math.round(amount * 100) });
//     return { ok: true, ref: re.id, failureReason: null };
//   }
// };

const drivers = { mock: mockDriver /*, stripe: stripeDriver */ };
const driver = drivers[config.payment.driver] || mockDriver;

module.exports = {
  charge: (args) => driver.charge(args),
  refund: (args) => driver.refund(args)
};
