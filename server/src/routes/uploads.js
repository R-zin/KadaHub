const express = require('express');
const multer = require('multer');
const path = require('path');
const storageService = require('../services/storageService');
const { authenticate } = require('../middleware/auth');
const ApiError = require('../utils/ApiError');
const asyncH = require('../utils/asyncHandler');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(ApiError.badRequest('Only image uploads are allowed'));
    cb(null, true);
  }
});

// Upload an image (e.g. a try-on source photo or product reference image).
router.post('/', authenticate, upload.single('image'), asyncH(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image file provided (field name "image")');
  const ext = path.extname(req.file.originalname) || '.jpg';
  const folder = req.body.folder === 'tryon' ? 'tryon' : 'misc';
  const { url } = await storageService.save(req.file.buffer, { ext, folder });
  res.status(201).json({ url });
}));

module.exports = router;
