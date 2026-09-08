const config = require('../config');
const { query } = require('../db');

/**
 * Notification service interface (swappable).
 *   notify(userId, message)   -> persists an in-app notification + sends via channel
 * Select the channel with NOTIFICATION_DRIVER. 'console' logs in dev.
 * A real email/SMS provider can be added without touching callers.
 */

const consoleChannel = {
  async send(userId, message) {
    console.log(`[notify:user ${userId}] ${message}`);
  }
};

// const emailChannel = { async send(userId, message) { /* SES / SendGrid ... */ } };
// const smsChannel   = { async send(userId, message) { /* Twilio ... */ } };

const channels = { console: consoleChannel };
const channel = channels[config.notifications.driver] || consoleChannel;

/** Persist an in-app notification row, then push it through the channel. */
const notify = async (userId, message) => {
  await query('INSERT INTO notifications (user_id, message) VALUES ($1, $2)', [userId, message]);
  try {
    await channel.send(userId, message);
  } catch (err) {
    console.error('Notification channel failed:', err.message);
  }
};

module.exports = { notify };
