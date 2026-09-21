const ApiError = require('../utils/ApiError');
const { query, withTransaction } = require('../db');
const paymentService = require('./paymentService');
const { notify } = require('./notificationService');

const toReturn = (row) => ({
  id: String(row.id),
  orderId: String(row.order_id),
  orderNumber: row.order_number,
  productId: String(row.product_id),
  productName: row.product_name,
  customerName: row.customer_name,
  reason: row.reason,
  status: row.status,
  createdAt: row.created_at
});

/** Customer requests a return for a delivered order item. */
const request = async (userId, { orderId, productId, reason }) => {
  const numOrderId = Number(orderId);
  const numProductId = Number(productId);
  if (isNaN(numOrderId) || !Number.isInteger(numOrderId) || numOrderId <= 0 ||
      isNaN(numProductId) || !Number.isInteger(numProductId) || numProductId <= 0) {
    throw ApiError.badRequest('Invalid order ID or product ID');
  }
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw ApiError.badRequest('Return reason is required');
  }

  const { rows: orderRows } = await query('SELECT * FROM orders WHERE id = $1', [numOrderId]);
  const order = orderRows[0];
  if (!order) throw ApiError.notFound('Order not found');
  if (Number(order.customer_id) !== Number(userId)) throw ApiError.forbidden('Not your order');
  if (order.status !== 'Delivered') throw ApiError.conflict('Returns are only allowed on delivered orders');

  const { rows: delRows } = await query('SELECT delivered_at FROM deliveries WHERE order_id = $1', [Number(orderId)]);
  const delivery = delRows[0];
  const deliveredAt = delivery?.delivered_at || order.placed_at;
  const returnWindowDays = Number(process.env.RETURN_WINDOW_DAYS || 14);
  const diffTime = Date.now() - new Date(deliveredAt).getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  if (diffDays > returnWindowDays) {
    throw ApiError.conflict(`Return window has expired. Returns are only allowed within ${returnWindowDays} days of delivery.`);
  }

  const { rows: itemRows } = await query(
    'SELECT * FROM order_items WHERE order_id = $1 AND product_id = $2',
    [Number(orderId), Number(productId)]
  );
  if (!itemRows.length) throw ApiError.notFound('That item is not part of this order');

  const { rows: existing } = await query(
    `SELECT id FROM returns WHERE order_id = $1 AND product_id = $2 AND status NOT IN ('Rejected')`,
    [Number(orderId), Number(productId)]
  );
  if (existing.length) throw ApiError.conflict('Return request already exists for this item.');

  const { rows } = await query(
    `INSERT INTO returns (order_id, order_item_id, product_id, customer_id, reason)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [Number(orderId), itemRows[0].id, Number(productId), userId, reason]
  );
  await notify(userId, `Return request submitted for order #${order.order_number}.`);
  return toReturn({ ...rows[0], order_number: order.order_number, product_name: itemRows[0].product_name });
};

const listFor = async (user) => {
  let sql = `
    SELECT r.*, o.order_number, p.name AS product_name, u.name AS customer_name
    FROM returns r
    JOIN orders o ON o.id = r.order_id
    JOIN products p ON p.id = r.product_id
    JOIN users u ON u.id = r.customer_id
  `;
  const params = [];
  if (user.role === 'customer') { params.push(user.id); sql += ' WHERE r.customer_id = $1'; }
  sql += ' ORDER BY r.created_at DESC';
  const { rows } = await query(sql, params);
  return rows.map(toReturn);
};

/**
 * Admin approves a return: refund via the payment gateway and restock the item.
 * All in one transaction.
 */
const approve = async (returnId, admin) => {
  const numReturnId = Number(returnId);
  if (isNaN(numReturnId) || !Number.isInteger(numReturnId) || numReturnId <= 0) {
    throw ApiError.notFound('Return not found');
  }

  const result = await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM returns WHERE id = $1 FOR UPDATE', [numReturnId]);
    const ret = rows[0];
    if (!ret) throw ApiError.notFound('Return not found');
    if (ret.status !== 'Requested') {
      throw ApiError.conflict(`Cannot approve return in status "${ret.status}" (only Requested returns can be approved)`);
    }

    // Original charge for this order.
    const { rows: payRows } = await client.query(
      `SELECT * FROM payments WHERE order_id = $1 AND type = 'charge' AND status = 'Paid'`,
      [ret.order_id]
    );
    const charge = payRows[0];

    // Refund the item's value.
    const { rows: itemRows } = await client.query('SELECT * FROM order_items WHERE id = $1', [ret.order_item_id]);
    const item = itemRows[0];
    const refundAmount = item ? Number(item.unit_price) * item.quantity : 0;

    let refundRef = null;
    if (charge && refundAmount > 0) {
      const refund = await paymentService.refund({ amount: refundAmount, currency: charge.currency, chargeRef: charge.provider_ref });
      if (!refund.ok) throw ApiError.badRequest(`Refund failed: ${refund.failureReason}`);
      refundRef = refund.ref;
    }

    // Record the refund payment row (one refund per order, enforced by UNIQUE(order_id, type)).
    let refundPaymentId = null;
    if (charge) {
      const { rows: rp } = await client.query(
        `INSERT INTO payments (order_id, provider, provider_ref, amount, currency, type, status)
         VALUES ($1, $2, $3, $4, $5, 'refund', 'Paid')
         ON CONFLICT (order_id, type) DO UPDATE SET amount = payments.amount + EXCLUDED.amount, status = 'Paid' RETURNING id`,
        [ret.order_id, charge.provider, refundRef, refundAmount, charge.currency]
      );
      refundPaymentId = rp[0] ? rp[0].id : null;
    }

    // Restock the product safely (only once).
    if (item && !ret.restocked) {
      await client.query('UPDATE products SET stock = stock + $1, updated_at = now() WHERE id = $2', [item.quantity, ret.product_id]);
    }

    const { rows: updated } = await client.query(
      `UPDATE returns SET status = 'Refunded', restocked = TRUE, refund_payment_id = $1,
         reviewed_by = $2, resolved_at = now() WHERE id = $3 RETURNING *`,
      [refundPaymentId, admin.id, ret.id]
    );
    return updated[0];
  });

  await notify(result.customer_id, `Your return for order #${result.order_id} was approved and refunded.`);
  return toReturn(result);
};

/** Admin rejects a return. */
const reject = async (returnId, admin) => {
  const numReturnId = Number(returnId);
  if (isNaN(numReturnId) || !Number.isInteger(numReturnId) || numReturnId <= 0) {
    throw ApiError.notFound('Return not found');
  }

  const { rows: existing } = await query('SELECT id, status, customer_id FROM returns WHERE id = $1', [numReturnId]);
  if (!existing.length) throw ApiError.notFound('Return not found');
  if (existing[0].status !== 'Requested') {
    throw ApiError.conflict(`Cannot reject return in status "${existing[0].status}" (only Requested returns can be rejected)`);
  }

  const { rows } = await query(
    `UPDATE returns SET status = 'Rejected', reviewed_by = $1, resolved_at = now()
     WHERE id = $2 AND status = 'Requested' RETURNING *`,
    [admin.id, numReturnId]
  );
  if (!rows.length) throw ApiError.conflict('Return already resolved');
  await notify(rows[0].customer_id, `Your return request was rejected.`);
  return toReturn(rows[0]);
};

module.exports = { request, listFor, approve, reject };
