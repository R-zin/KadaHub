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
  // Handle JSON parse errors from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: { message: 'Malformed JSON in request body', status: 400 }
    });
  }

  // Handle Multer upload errors (e.g. LIMIT_FILE_SIZE)
  if (err.name === 'MulterError') {
    return res.status(400).json({
      error: { message: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (maximum allowed size is 5MB)' : (err.message || 'File upload error'), status: 400 }
    });
  }

  const isClientError = err.status && err.status >= 400 && err.status < 500;
  const status = err.isApiError ? err.status : (isClientError ? err.status : 500);
  const message = err.isApiError
    ? err.message
    : (status === 400 ? (err.message || 'Bad request') : 'Something went wrong. Please try again.');

  if (!err.isApiError && status === 500) {
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
