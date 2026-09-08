const config = require('../config');

/** 404 for unmatched API routes. */
const notFound = (req, res, next) => {
  res.status(404).json({ error: { message: 'Route not found', status: 404 } });
};

/**
 * Central error handler. ApiError -> its status + safe message.
 * Everything else -> 500 with a generic message (details logged server-side only).
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const status = err.isApiError ? err.status : 500;
  const message = err.isApiError ? err.message : 'Something went wrong. Please try again.';

  if (!err.isApiError) {
    // Log internals server-side; never send them to the client.
    console.error('[unhandled error]', err);
  }

  const body = { error: { message, status } };
  if (err.isApiError && err.details) body.error.details = err.details;
  if (!config.isProd && err.isApiError === undefined && process.env.DEBUG_ERRORS) {
    body.error.debug = String(err.stack || err);
  }
  res.status(status).json(body);
};

module.exports = { notFound, errorHandler };
