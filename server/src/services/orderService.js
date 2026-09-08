const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const { query, withTransaction } = require('../db');
const paymentService = require('./paymentService');
const { notify } = require('./notificationService');
const { toProduct } = require('./productService');

const ORDER_TIMELINE = ['Order Placed', 'Payment Confirmed', 'Processing', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered'];

/** Match the frontend's pricing rules. */
const priceCart = (items) => {
  const subtotal = items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
  const deliveryFee = subtotal > 100 || subtotal === 0 ? 0 : 8;
  const discount = subtotal > 500 ? subtotal * 0.08 : 0;
  const total = subtotal + deliveryFee - discount;
  return { subtotal, deliveryFee, discount, total };
};

const generateOrderNumber = () => `EC${Math.floor(10000 + Math.random() * 89999)}`;

const toOrder = (row, items) => ({
  id: String(row.id),
  orderNumber: row.order_number,
  date: row.placed_at,
  status: row.status,
  paymentStatus: row.payment_status || 'Pending',
  total: Number(row.total),
  subtotal: Number(row.subtotal),
  deliveryFee: Number(row.delivery_fee),
  discount: Number(row.discount),
  deliveryAddress: {
    name: row.ship_name, phone: row.ship_phone, line1: row.ship_line1,
    city: row.ship_city, region: row.ship_region, postalCode: row.ship_postal_code
  },
  deliveryAgentId: row.delivery_agent_id != null ? String(row.delivery_agent_id) : undefined,
  items: items.map((it) => ({
    quantity: it.quantity,
    product: {
      id: String(it.product_id), name: it.product_name, price: Number(it.unit_price),
      images: it.product_image ? [it.product_image] : [], category: it.category_name || '',
      brand: '', rating: 0, reviewCount: 0, stock: 0, sellerId: '', sellerName: '',
      description: '', subcategory: '', specifications: {}, tags: [],
      isVirtualTryOnSupported: false, productType: ''
    }
  }))
});

const fetchItems = async (client, orderId) => {
  const { rows } = await client.query(
    `SELECT oi.*, c.name AS category_name
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     JOIN categories c ON c.id = p.category_id
     WHERE oi.order_id = $1 ORDER BY oi.id`,
    [orderId]
  );
  return rows;
};

const getOrderRow = `
  SELECT o.*, pay.payment_status, d.agent_id AS delivery_agent_id
  FROM orders o
  LEFT JOIN LATERAL (
    SELECT CASE
             WHEN bool_or(p.type = 'refund' AND p.status = 'Paid') THEN 'Refunded'
             WHEN bool_or(p.type = 'charge' AND p.status = 'Paid') THEN 'Paid'
             WHEN bool_or(p.type = 'charge' AND p.status = 'Failed') THEN 'Failed'
             ELSE 'Pending'
           END AS payment_status
    FROM payments p WHERE p.order_id = o.id
  ) pay ON TRUE
  LEFT JOIN deliveries d ON d.order_id = o.id
`;

/**
 * Checkout: verify stock -> charge payment -> create order/items/payment/delivery,
 * decrement stock, clear the cart, and notify. All in one transaction; if payment
 * fails we roll everything back and record a Failed payment note.
 */
const checkout = async (userId, address, payment = {}) => {
  const result = await withTransaction(async (client) => {
    // 1. Load the cart with a row lock on each product (prevents overselling).
    const { rows: cart } = await client.query(
      `SELECT ci.product_id, ci.quantity, p.name, p.price, p.stock,
              (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order LIMIT 1) AS image
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = $1 ORDER BY ci.added_at FOR UPDATE OF p`,
      [userId]
    );
    if (!cart.length) throw ApiError.badRequest('Your cart is empty');

    // 2. Verify stock before charging.
    for (const item of cart) {
      if (item.quantity > item.stock) {
        throw ApiError.conflict(`"${item.name}" does not have enough stock (requested ${item.quantity}, available ${item.stock}).`);
      }
    }

    // 3. Price the order.
    const totals = priceCart(cart);

    // 4. Charge through the payment gateway. Only proceed on success.
    const charge = await paymentService.charge({
      amount: totals.total, currency: 'usd', orderNumber: 'pending', customer: userId
    });
    if (!charge.ok) {
      await notify(userId, `Payment failed: ${charge.failureReason}. No order was placed.`);
      throw ApiError.badRequest(`Payment failed: ${charge.failureReason}`);
    }

    // 5. Create order + items + payment + delivery, decrement stock.
    const orderNumber = generateOrderNumber();
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (order_number, customer_id, status, subtotal, delivery_fee, discount, total,
         ship_name, ship_phone, ship_line1, ship_city, ship_region, ship_postal_code)
       VALUES ($1,$2,'Payment Confirmed',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [orderNumber, userId, totals.subtotal, totals.deliveryFee, totals.discount, totals.total,
       address.name, address.phone, address.line1, address.city, address.region, address.postalCode]
    );
    const order = orderRows[0];

    for (const item of cart) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, product_name, product_image)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [order.id, item.product_id, item.quantity, item.price, item.name, item.image]
      );
      await client.query('UPDATE products SET stock = stock - $1, updated_at = now() WHERE id = $2', [item.quantity, item.product_id]);
    }

    await client.query(
      `INSERT INTO payments (order_id, provider, provider_ref, amount, currency, type, status)
       VALUES ($1, $2, $3, $4, 'USD', 'charge', 'Paid')`,
      [order.id, 'stripe_test', charge.ref, totals.total]
    );

    // Auto-assign the delivery to the least-busy available agent.
    const { rows: agents } = await client.query(
      `SELECT u.id, COUNT(d.id) AS open FROM users u
       LEFT JOIN deliveries d ON d.agent_id = u.id AND d.status NOT IN ('Delivered','Failed')
       WHERE u.role = 'delivery' AND u.is_active
       GROUP BY u.id ORDER BY open ASC, u.id ASC LIMIT 1`
    );
    await client.query(
      `INSERT INTO deliveries (order_id, agent_id, status, assigned_at) VALUES ($1, $2, 'Assigned', now())`,
      [order.id, agents[0] ? agents[0].id : null]
    );

    // 6. Clear the cart.
    await client.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);

    return { order, items: cart, totals };
  });

  // 7. Notify after commit (best effort).
  await notify(userId, `Order #${result.order.order_number} confirmed — ${result.items.length} item group(s), total $${result.totals.total.toFixed(2)}.`);

  const full = await getById(result.order.id, userId);
  return full;
};

/** List orders. Customers see their own; delivery agents see assigned; admin/seller see per scope. */
const listFor = async (user, { sellerId } = {}) => {
  let sql = getOrderRow;
  const params = [];
  if (user.role === 'customer') { params.push(user.id); sql += ' WHERE o.customer_id = $1'; }
  else if (user.role === 'delivery') { params.push(user.id); sql += ' WHERE d.agent_id = $1'; }
  else if (sellerId) { // seller: orders containing their products
    params.push(Number(sellerId));
    sql += ' WHERE EXISTS (SELECT 1 FROM order_items oi JOIN products pr ON pr.id = oi.product_id WHERE oi.order_id = o.id AND pr.seller_id = $1)';
  }
  sql += ' ORDER BY o.placed_at DESC';
  const { rows } = await query(sql, params);
  return Promise.all(rows.map(async (r) => toOrder(r, await fetchItems({ query }, r.id))));
};

const getById = async (id, user) => {
  const { rows } = await query(`${getOrderRow} WHERE o.id = $1`, [Number(id)]);
  const row = rows[0];
  if (!row) throw ApiError.notFound('Order not found');
  if (user && user.role === 'customer' && row.customer_id !== user.id) throw ApiError.forbidden('Not your order');
  const items = await fetchItems({ query }, row.id);
  return toOrder(row, items);
};

/** Advance an order to the next delivery status (delivery agent or admin). */
const advanceStatus = async (orderId, actor) => {
  const { rows } = await query(`${getOrderRow} WHERE o.id = $1`, [Number(orderId)]);
  const row = rows[0];
  if (!row) throw ApiError.notFound('Order not found');
  if (actor.role === 'delivery' && row.delivery_agent_id !== actor.id) throw ApiError.forbidden('This order is not assigned to you');

  const idx = ORDER_TIMELINE.indexOf(row.status);
  if (idx < 0 || idx >= ORDER_TIMELINE.length - 1) return getById(orderId);
  const next = ORDER_TIMELINE[idx + 1];

  await withTransaction(async (client) => {
    await client.query('UPDATE orders SET status = $1 WHERE id = $2', [next, orderId]);
    const delivered = next === 'Delivered';
    await client.query(
      `UPDATE deliveries SET status = $1, updated_at = now() ${delivered ? ', delivered_at = now()' : ''} WHERE order_id = $2`,
      [delivered ? 'Delivered' : next, orderId]
    );
  });
  await notify(row.customer_id, `Your order #${row.order_number} is now "${next}".`);
  return getById(orderId, actor);
};

module.exports = { checkout, listFor, getById, advanceStatus, priceCart, ORDER_TIMELINE };
