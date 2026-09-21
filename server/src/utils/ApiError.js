/**
 * Application error carrying an HTTP status and a client-safe message.
 * Anything thrown that is NOT an ApiError is treated as a 500 and its
 * internals are never leaked to the client.
 */
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
    this.isApiError = true;
  }
  static badRequest(msg, details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Authentication required') { return new ApiError(401, msg); }
  static forbidden(msg = 'You do not have access to this resource') { return new ApiError(403, msg); }
  static notFound(msg = 'Resource not found') { return new ApiError(404, msg); }
  static conflict(msg, details) { return new ApiError(409, msg, details); }
  static badGateway(msg, details) { return new ApiError(502, msg, details); }
  static serviceUnavailable(msg, details) { return new ApiError(503, msg, details); }
}

module.exports = ApiError;
