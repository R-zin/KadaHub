const fs = require('fs');
const path = require('path');
const config = require('../config');
const ApiError = require('../utils/ApiError');

/**
 * Modal driver for the AI Virtual Try-On service.
 *
 * Calls the IDM-VTON model deployed as a Modal web endpoint
 * (see modal/tryon_app.py) and persists the returned PNG via storageService,
 * returning a URL the SPA can render.
 *
 * Contract: generatePreview({ product, sourceImage, size, color }) -> { previewImage }
 *
 * Notes
 * -----
 * - `sourceImage` is the user's uploaded person photo. In dev it lives under
 *   the authenticated `tryon-temp` route, which the Modal function cannot fetch,
 *   so we always send it as base64 read from local disk.
 * - The garment image (product photo) is sent as a public URL when available
 *   (Supabase storage); otherwise it is read from the local uploads dir and sent
 *   as base64.
 */

const EXT_TO_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

const extOf = (p) => path.extname(p).toLowerCase();

// Read a locally-stored upload ("/uploads/..." or bare path) into base64.
const readLocalAsBase64 = (urlOrPath) => {
  const uploadDir = path.resolve(process.cwd(), config.storage.uploadDir);
  let rel = urlOrPath;
  if (rel.startsWith(`/${config.storage.uploadDir}/`)) {
    rel = rel.slice(`/${config.storage.uploadDir}/`.length);
  } else if (rel.startsWith(config.storage.uploadDir)) {
    rel = rel.replace(new RegExp(`^${config.storage.uploadDir}[\\\\/]+`), '');
  }
  const filePath = path.resolve(uploadDir, rel);
  if (!filePath.startsWith(uploadDir)) {
    throw ApiError.badRequest('Invalid image path.');
  }
  const buf = fs.readFileSync(filePath);
  return buf.toString('base64');
};

const isPublicUrl = (s) => /^https?:\/\//i.test(s);

const garmentDescriptionFor = (product) => {
  // A short garment prompt improves conditioning. Product name is a good start.
  const name = (product && product.name) || 'a garment';
  return name;
};

const modalDriver = {
  async generatePreview({ product, sourceImage, size, color }) {
    if (!product.is_virtual_try_on_supported) {
      throw ApiError.badRequest('Virtual Try-On is not supported for this product.');
    }
    if (!config.tryOn.modalUrl) {
      throw ApiError.badRequest('TRYON_MODAL_URL is not configured for the modal try-on driver.');
    }

    // --- person image (user upload) ---
    let person_image_b64;
    if (isPublicUrl(sourceImage)) {
      // Fetch server-side and forward as b64 (keeps auth/local handling uniform).
      const resp = await fetch(sourceImage);
      if (!resp.ok) throw ApiError.badGateway('Could not fetch the source image.');
      person_image_b64 = Buffer.from(await resp.arrayBuffer()).toString('base64');
    } else {
      person_image_b64 = readLocalAsBase64(sourceImage);
    }

    // --- garment image (product photo) ---
    const garmentUrl =
      (product.images && product.images.find((u) => isPublicUrl(u))) ||
      (isPublicUrl(product.image) ? product.image : null);
    const garmentLocal =
      (product.images && product.images[0]) || product.image;

    let garment_image_url;
    let garment_image_b64;
    if (garmentUrl) {
      garment_image_url = garmentUrl;
    } else if (garmentLocal) {
      garment_image_b64 = readLocalAsBase64(garmentLocal);
    } else {
      throw ApiError.badRequest('This product has no garment image to try on.');
    }

    // --- call Modal endpoint ---
    const payload = {
      person_image_b64,
      garment_description: garmentDescriptionFor(product),
      category: 'upper_body',
      steps: config.tryOn.steps,
      seed: 42
    };
    if (garment_image_url) payload.garment_image_url = garment_image_url;
    if (garment_image_b64) payload.garment_image_b64 = garment_image_b64;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.tryOn.timeoutMs);

    let data;
    try {
      const resp = await fetch(config.tryOn.modalUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.tryOn.modalToken ? { Authorization: `Bearer ${config.tryOn.modalToken}` } : {})
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw ApiError.badGateway(`Try-on model error (HTTP ${resp.status}): ${text.slice(0, 300)}`);
      }
      data = await resp.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        throw ApiError.badGateway('Try-on generation timed out. Please try again.');
      }
      if (err.isApiError) throw err;
      throw ApiError.badGateway(`Try-on request failed: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!data || !data.image_b64) {
      throw ApiError.badGateway('Try-on model returned no image.');
    }

    // --- persist result and return a URL ---
    const png = Buffer.from(data.image_b64, 'base64');
    const { url } = await require('./storageService').save(png, {
      folder: 'tryon-results',
      ext: '.png',
      contentType: 'image/png'
    });

    return { previewImage: url };
  }
};

module.exports = modalDriver;
