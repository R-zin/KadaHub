const express = require('express');
const multer = require('multer');
const path = require('path');
const storageService = require('../services/storageService');
const { authenticate } = require('../middleware/auth');
const ApiError = require('../utils/ApiError');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(ApiError.badRequest('Only image uploads are allowed'));
    cb(null, true);
  }
});

// Upload single or multiple images (e.g. product images or try-on source photos).
router.post('/', authenticate, upload.any(), async (req, res, next) => {
  try {
    const files = req.files || [];
    if (!files.length) throw ApiError.badRequest('No image file provided (field name "image" or "images")');
    const folder = req.body.folder === 'tryon' ? 'tryon' : 'products';
    const urls = [];
    for (const file of files) {
      const ext = path.extname(file.originalname) || '.jpg';
      const { url } = await storageService.save(file.buffer, { ext, folder });
      urls.push(url);
    }
    res.status(201).json({ url: urls[0], urls });
  } catch (err) { next(err); }
});

module.exports = router;
