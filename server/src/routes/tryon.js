const express = require('express');
const fs = require('fs');
const path = require('path');
const tryOnDomain = require('../services/tryOnDomain');
const storageService = require('../services/storageService');
const config = require('../config');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const ApiError = require('../utils/ApiError');

const router = express.Router();
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate);

// Generate (and persist) a try-on preview for a supported product.
router.post(
  '/generate',
  validate({
    productId: { required: true },
    sourceImage: { required: true, type: 'string' },
    size: { type: 'string' },
    color: { type: 'string' }
  }),
  asyncH(async (req, res) => res.status(201).json({ result: await tryOnDomain.generate(req.user.id, req.body) }))
);

router.get('/', asyncH(async (req, res) => res.json({ results: await tryOnDomain.listFor(req.user.id) })));

// Securely access temporary try-on image with ownership verification
router.get(
  '/temp/:filename',
  asyncH(async (req, res) => {
    const { filename } = req.params;

    // Strict filename validation: reject path traversal or malicious names
    const match = filename.match(/^tryon_(\d+)__[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i);
    if (!match) {
      throw ApiError.badRequest('Invalid temporary image identifier.');
    }

    const ownerId = match[1];
    if (req.user.role !== 'admin' && String(req.user.id) !== String(ownerId)) {
      throw ApiError.forbidden('Access denied: You do not own this temporary image.');
    }

    const baseDir = path.resolve(process.cwd(), config.storage.uploadDir, 'tryon-temp');
    const filePath = path.resolve(baseDir, filename);

    if (!filePath.startsWith(baseDir)) {
      throw ApiError.forbidden('Invalid path traversal detected.');
    }

    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      throw ApiError.notFound('Temporary image not found or expired.');
    }

    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp'
    };

    res.set({
      'Content-Type': mimeTypes[ext] || 'image/jpeg',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff'
    });

    fs.createReadStream(filePath).pipe(res);
  })
);

// Delete temporary try-on image (user cancels, retakes, or cleanup)
router.delete(
  '/temp/:filename',
  asyncH(async (req, res) => {
    const { filename } = req.params;

    const match = filename.match(/^tryon_(\d+)__[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i);
    if (!match) {
      throw ApiError.badRequest('Invalid temporary image identifier.');
    }

    const ownerId = match[1];
    if (req.user.role !== 'admin' && String(req.user.id) !== String(ownerId)) {
      throw ApiError.forbidden('Access denied: You do not own this temporary image.');
    }

    const deleted = await storageService.delete(`tryon-temp/${filename}`);
    res.json({ success: true, deleted });
  })
);

module.exports = router;
