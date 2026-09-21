const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const storageService = require('../services/storageService');
const { validateImageFile, MAX_FILE_SIZE } = require('../services/imageValidation');
const { authenticate } = require('../middleware/auth');
const ApiError = require('../utils/ApiError');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    // Basic initial check; deep magic-byte inspection is performed per-buffer
    if (!file.mimetype.startsWith('image/')) {
      return cb(ApiError.badRequest('Only image uploads are allowed'));
    }
    cb(null, true);
  }
});

// Upload single or multiple images (e.g. product images or try-on source photos).
router.post('/', authenticate, upload.any(), async (req, res, next) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      throw ApiError.badRequest('No image file provided (field name "image" or "images")');
    }

    const isTryOn = req.body.folder === 'tryon';
    const folder = isTryOn ? 'tryon-temp' : 'products';
    const urls = [];

    for (const file of files) {
      // 1. Rigorous buffer magic bytes validation
      const detected = validateImageFile(file);

      // 2. Cryptographically secure non-predictable filename
      let fileName;
      if (isTryOn) {
        // Encode authenticated user ID in temporary tryon filenames for ownership verification
        fileName = `tryon_${req.user.id}__${crypto.randomUUID()}${detected.ext}`;
      } else {
        fileName = `${crypto.randomUUID()}${detected.ext}`;
      }

      // 3. Save to storage
      const { url } = await storageService.save(file.buffer, {
        folder,
        fileName,
        ext: detected.ext,
        contentType: detected.mime
      });

      urls.push(url);
    }

    res.status(201).json({
      url: urls[0],
      urls,
      isTemporary: isTryOn
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
