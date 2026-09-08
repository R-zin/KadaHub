const config = require('../config');
const ApiError = require('../utils/ApiError');

/**
 * AI Virtual Try-On interface (swappable).
 *   generatePreview({ product, sourceImage, size, color }) -> { previewImage }
 * Select with TRYON_DRIVER. 'mock' returns a plausible composited preview.
 * A real ML provider (body detection + garment rendering) can be dropped in here.
 */

const mockDriver = {
  async generatePreview({ product, sourceImage, size, color }) {
    if (!product.is_virtual_try_on_supported) {
      throw ApiError.badRequest('Virtual Try-On is not supported for this product.');
    }
    // Simulate inference latency.
    await new Promise((r) => setTimeout(r, 800));
    // The mock "composite" is just the product's own image; a real provider
    // would return a rendered image URL from storage.
    const preview = (product.images && product.images[0]) || product.image || sourceImage;
    return { previewImage: preview };
  }
};

// const mlDriver = { async generatePreview({ product, sourceImage, size, color }) {
//   // call a hosted garment-rendering API, persist the result via storageService,
//   // and return { previewImage: url }
// } };

const drivers = { mock: mockDriver };
const driver = drivers[config.tryOn.driver] || mockDriver;

module.exports = {
  generatePreview: (args) => driver.generatePreview(args)
};
