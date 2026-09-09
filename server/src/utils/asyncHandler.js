/**
 * Wraps an async route handler so rejections flow to next(err).
 */
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncH;
