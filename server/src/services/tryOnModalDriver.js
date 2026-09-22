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

const isLocalUpload = (urlOrPath) => {
  if (!urlOrPath || typeof urlOrPath !== 'string') return false;
  const uploadPrefix = `/${config.storage.uploadDir}/`;
  if (urlOrPath.startsWith(uploadPrefix) || urlOrPath.startsWith(config.storage.uploadDir)) {
    return true;
  }
  try {
    const parsed = new URL(urlOrPath);
    const host = parsed.hostname.toLowerCase();
    const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (isLoopback) return true;
    if (parsed.pathname.startsWith(uploadPrefix) || parsed.pathname.includes(uploadPrefix)) {
      return true;
    }
  } catch {
    if (urlOrPath.includes(uploadPrefix)) return true;
  }
  return false;
};

// Check if a URL is a genuine public remote URL (non-local, non-internal, non-SSRF)
const isPublicUrl = (s) => {
  if (!s || typeof s !== 'string') return false;
  if (!/^https?:\/\//i.test(s)) return false;
  if (isLocalUpload(s)) return false;
  try {
    const parsed = new URL(s);
    const host = parsed.hostname.toLowerCase();
    // Block loopback, link-local, and private RFC-1918 / cloud metadata ranges
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      (host.startsWith('172.') && parseInt(host.split('.')[1], 10) >= 16 && parseInt(host.split('.')[1], 10) <= 31)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

// Read a locally-stored upload ("/uploads/..." or "http://localhost:4000/uploads/..." or bare path) into base64.
const readLocalAsBase64 = (urlOrPath) => {
  if (!urlOrPath || typeof urlOrPath !== 'string') {
    throw ApiError.badRequest('Invalid image path.');
  }

  let rel = urlOrPath;
  try {
    if (/^https?:\/\//i.test(urlOrPath)) {
      const parsed = new URL(urlOrPath);
      rel = parsed.pathname;
    }
  } catch {
    // Not a full URL, use raw path
  }

  const uploadDir = path.resolve(process.cwd(), config.storage.uploadDir);
  const uploadPrefix = `/${config.storage.uploadDir}/`;

  if (rel.startsWith(uploadPrefix)) {
    rel = rel.slice(uploadPrefix.length);
  } else if (rel.startsWith(config.storage.uploadDir)) {
    rel = rel.replace(new RegExp(`^${config.storage.uploadDir}[\\\\/]+`), '');
  } else if (rel.includes(uploadPrefix)) {
    rel = rel.split(uploadPrefix)[1];
  }

  // Prevent path traversal outside the designated uploads directory
  const filePath = path.resolve(uploadDir, rel);
  if (!filePath.startsWith(uploadDir)) {
    throw ApiError.badRequest('Invalid image path: traversal prohibited.');
  }

  if (!fs.existsSync(filePath)) {
    throw ApiError.notFound('Source image not found on server.');
  }

  const buf = fs.readFileSync(filePath);
  return buf.toString('base64');
};

const garmentDescriptionFor = (product, size, color) => {
  // A short, concrete prompt gives the model useful conditioning in addition to
  // the garment photo. "Original" is an interface value, not a colour cue.
  const name = (product && product.name) || 'a garment';
  const details = [name];
  if (color && color.toLowerCase() !== 'original') details.push(`${color} colour`);
  if (size) details.push(`size ${size}`);
  return details.join(', ');
};

const garmentCategoryFor = (product) => {
  const label = [product?.product_type, product?.subcategory, product?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/\b(dress|gown|saree|lehenga|jumpsuit)\b/.test(label)) return 'dresses';
  if (/\b(jeans?|trousers?|pants?|shorts?|skirt|leggings?|joggers?)\b/.test(label)) return 'lower_body';
  return 'upper_body';
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
    if (isLocalUpload(sourceImage) || !isPublicUrl(sourceImage)) {
      // Local upload: read directly from disk (NEVER fetch localhost)
      person_image_b64 = readLocalAsBase64(sourceImage);
    } else {
      // Genuine external/public URL: fetch server-side and forward as b64
      const resp = await fetch(sourceImage);
      if (!resp.ok) throw ApiError.badGateway('Could not fetch the source image.');
      person_image_b64 = Buffer.from(await resp.arrayBuffer()).toString('base64');
    }

    // --- garment image (product photo) ---
    const garmentUrl =
      (product.images && product.images.find((u) => isPublicUrl(u))) ||
      (isPublicUrl(product.image) ? product.image : null);
    const garmentLocal =
      (product.images && product.images.find((u) => isLocalUpload(u) || !isPublicUrl(u))) ||
      (product.image && !isPublicUrl(product.image) ? product.image : null) ||
      (product.images && product.images[0]) ||
      product.image ||
      sourceImage;

    let garment_image_url;
    let garment_image_b64;
    if (garmentUrl) {
      garment_image_url = garmentUrl;
    } else if (garmentLocal) {
      if (isLocalUpload(garmentLocal) || !isPublicUrl(garmentLocal)) {
        garment_image_b64 = readLocalAsBase64(garmentLocal);
      } else {
        garment_image_url = garmentLocal;
      }
    } else {
      throw ApiError.badRequest('This product has no garment image to try on.');
    }

    // --- call Modal endpoint ---
    const payload = {
      person_image_b64,
      garment_description: garmentDescriptionFor(product, size, color),
      category: garmentCategoryFor(product),
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
        console.warn(`[tryOnModalDriver] Modal upstream error (HTTP ${resp.status}): ${text.slice(0, 200)}`);
        // Graceful fallback to composite preview if cloud provider fails/unauthorized
        const fallbackPreview = garmentUrl || (product.images && product.images[0]) || product.image || sourceImage;
        return { previewImage: fallbackPreview };
      }
      data = await resp.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn('[tryOnModalDriver] Modal generation timed out, falling back to preview.');
      } else if (err.isApiError) {
        throw err;
      } else {
        console.warn(`[tryOnModalDriver] Modal request failed (${err.message}), falling back to preview.`);
      }
      const fallbackPreview = garmentUrl || (product.images && product.images[0]) || product.image || sourceImage;
      return { previewImage: fallbackPreview };
    } finally {
      clearTimeout(timer);
    }

    if (!data || !data.image_b64) {
      const fallbackPreview = garmentUrl || (product.images && product.images[0]) || product.image || sourceImage;
      return { previewImage: fallbackPreview };
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
