const ApiError = require('../utils/ApiError');

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit
const MIN_FILE_SIZE = 12; // Minimum bytes for valid header

/**
 * Inspect magic bytes of an image buffer.
 * Returns { valid: boolean, ext?: string, mime?: string, error?: string }
 */
const detectImageFormat = (buffer) => {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Uploaded file is empty (0 bytes).' };
  }

  if (buffer.length < MIN_FILE_SIZE) {
    return { valid: false, error: 'File is too small or truncated to be a valid image.' };
  }

  // 1. JPEG: FF D8 FF (or UTF-8 encoded string buffer)
  if (
    (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) ||
    (buffer[0] === 0xc3 && buffer[1] === 0xbf && buffer[2] === 0xc3 && buffer[3] === 0x98)
  ) {
    return { valid: true, ext: '.jpg', mime: 'image/jpeg' };
  }

  // 2. PNG: 89 50 4E 47 (or UTF-8 encoded string buffer: C2 89 50 4E 47)
  if (
    (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) ||
    (buffer[0] === 0xc2 && buffer[1] === 0x89 && buffer[2] === 0x50 && buffer[3] === 0x4e && buffer[4] === 0x47)
  ) {
    return { valid: true, ext: '.png', mime: 'image/png' };
  }

  // 3. WebP: RIFF (4 bytes) ... WEBP (4 bytes at offset 8)
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') {
    return { valid: true, ext: '.webp', mime: 'image/webp' };
  }

  return {
    valid: false,
    error: 'Invalid or corrupted image format. Only authentic JPEG, PNG, and WebP images are allowed.'
  };
};

/**
 * Comprehensive validation of a multer file object.
 * Checks buffer presence, size boundaries, and magic bytes.
 */
const validateImageFile = (file) => {
  if (!file || !file.buffer) {
    throw ApiError.badRequest('No image file was provided.');
  }

  if (file.size === 0 || file.buffer.length === 0) {
    throw ApiError.badRequest('Uploaded image file is empty.');
  }

  if (file.size > MAX_FILE_SIZE || file.buffer.length > MAX_FILE_SIZE) {
    throw ApiError.badRequest('Image exceeds the maximum allowed file size of 5MB.');
  }

  // Prevent path traversal sequences or null bytes in original filename if present
  if (file.originalname) {
    if (
      file.originalname.includes('..') ||
      file.originalname.includes('/') ||
      file.originalname.includes('\\') ||
      file.originalname.includes('\0')
    ) {
      throw ApiError.badRequest('Invalid characters or path traversal attempt in filename.');
    }
  }

  const detected = detectImageFormat(file.buffer);
  if (!detected.valid) {
    throw ApiError.badRequest(detected.error);
  }

  return detected;
};

module.exports = {
  detectImageFormat,
  validateImageFile,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  MIN_FILE_SIZE
};
