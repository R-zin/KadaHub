const ApiError = require('../utils/ApiError');

/**
 * Tiny validator: rules is { field: { required, type, max, enum, ... } }.
 * Validates req[source] (body by default) and throws a 400 listing all problems.
 */
const validate = (rules, source = 'body') => (req, res, next) => {
  const data = req[source] || {};
  const problems = [];

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];
    const missing = value === undefined || value === null || value === '';

    if (missing) {
      if (rule.required) problems.push(`${field} is required`);
      continue;
    }
    if (rule.type === 'string' && typeof value !== 'string') problems.push(`${field} must be a string`);
    if (rule.type === 'number' && (typeof value !== 'number' || Number.isNaN(value))) problems.push(`${field} must be a number`);
    if (rule.type === 'boolean' && typeof value !== 'boolean') problems.push(`${field} must be a boolean`);
    if (rule.type === 'array' && !Array.isArray(value)) problems.push(`${field} must be an array`);
    if (rule.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) problems.push(`${field} must be a valid email`);
    if (rule.enum && !rule.enum.includes(value)) problems.push(`${field} must be one of: ${rule.enum.join(', ')}`);
    if (rule.max && String(value).length > rule.max) problems.push(`${field} is too long (max ${rule.max})`);
    if (rule.min !== undefined && typeof value === 'number' && value < rule.min) problems.push(`${field} must be >= ${rule.min}`);
  }

  if (problems.length) return next(ApiError.badRequest('Validation failed', problems));
  next();
};

module.exports = validate;
