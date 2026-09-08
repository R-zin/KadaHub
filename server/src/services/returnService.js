const ApiError = require('../utils/ApiError');
const { query, withTransaction } = require('../db');
const paymentService = require('./paymentService');
const { notify } = require('./notificationService');

const toReturn = (row) => ({
  id: String(row.id),
  orderId: String(row.order_id),
  productId: String(row.product_id),
  reason: row.reason,
  status: row.status,
  createdAt: row.created_at
});

/** Customer requests a return for a delivered order item. */
const request = async (userId, { orderId, productId, reason }) => {
  const { rows: orderRows } = await query('SELECT * FROM orders WHERE id = $1', [Number(orderId)]);
  const order = orderRows[0];
  if (!order) throw ApiError.notFound('Order not found');
  if (order.customer_id !== userId) throw ApiError.forbidden('Not your order');
  if (order.status !== 'Delivered') throw ApiError.conflict('Returns are only allowed on delivered orders');

  const { rows: itemRows } = await query(
    'SELECT * FROM order_items WHERE order_id = $1 AND product_id = $2',
    [Number(orderId), Number(productId)]
  );
  if (!itemRows.length) throw ApiError.notFound('That item is not part of this order');

  const { rows: existing } = await query(
    `SELECT id FROM returns WHERE order_id = $1 AND product_id = $2 AND status NOT IN ('Rejected')`,
    [Number(orderId), Number(productId)]
  );
  if (existing.length) throw ApiError.conflict('A return for this item is already in progress');

  const { rows } = await query(
    `INSERT INTO returns (order_id, order_item_id, product_id, customer_id, reason)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [Number(orderId), itemRows[0].id, Number(productId), userId, reason]
  );
  await notify(userId, `Return request submitted for order #${order.order_number}.`);
  return toReturn(rows[0]);
};

const listFor = async (user) => {
  let sql = 'SELECT * FROM returns';
  const params = [];
  if (user.role === 'customer') { params.push(user.id); sql += ' WHERE customer_id = $1'; }
  sql += ' ORDER BY created_at DESC';
  const { rows } = await query(sql, params);
  return rows.map(toReturn);
};

/**
 * Admin approves a return: refund via the payment gateway and restock the item.
 * All in one transaction.
 */
const approve = async (returnId, admin) => {
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM returns WHERE id = $1 FOR UPDATE', [Number(returnId)]);
    const ret = rows[0];
    if (!ret) throw ApiError.notFound('Return not found');
    if (['Refunded', 'Rejected'].includes(ret.status)) throw ApiError.conflict(`Return already ${ret.status.toLowerCase()}`);

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
         ON CONFLICT (order_id, type) DO NOTHING RETURNING id`,
        [ret.order_id, charge.provider, refundRef, refundAmount, charge.currency]
      );
      refundPaymentId = rp[0] ? rp[0].id : null;
    }

    // Restock the product.
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
  const { rows } = await query(
    `UPDATE returns SET status = 'Rejected', reviewed_by = $1, resolved_at = now()
     WHERE id = $2 AND status NOT IN ('Refunded','Rejected') RETURNING *`,
    [admin.id, Number(returnId)]
  );
  if (!rows.length) throw ApiError.conflict('Return not found or already resolved');
  await notify(rows[0].customer_id, `Your return request was rejected.`);
  return toReturn(rows[0]);
};

module.exports = { request, listFor, approve, reject };
