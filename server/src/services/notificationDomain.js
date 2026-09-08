const { query } = require('../db');

const toNotification = (row) => ({
  id: String(row.id),
  message: row.message,
  read: row.is_read,
  createdAt: row.created_at
});

const listFor = async (userId) => {
  const { rows } = await query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [userId]
  );
  return rows.map(toNotification);
};

const markAllRead = async (userId) => {
  await query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [userId]);
  return listFor(userId);
};

const dismiss = async (userId, id) => {
  await query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [Number(id), userId]);
  return listFor(userId);
};

module.exports = { listFor, markAllRead, dismiss };
