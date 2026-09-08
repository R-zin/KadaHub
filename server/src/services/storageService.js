const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

/**
 * Storage service interface.
 *   save(buffer, { ext, folder }) -> { url }
 * Swap the driver with STORAGE_DRIVER. Implementations: local (dev), s3 (later).
 */

const localDriver = {
  async save(buffer, { ext = '.bin', folder = 'misc' } = {}) {
    const dir = path.join(process.cwd(), config.storage.uploadDir, folder);
    await fs.promises.mkdir(dir, { recursive: true });
    const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    const filePath = path.join(dir, name);
    await fs.promises.writeFile(filePath, buffer);
    // Served statically by the app at /uploads/...
    return { url: `/${config.storage.uploadDir}/${folder}/${name}` };
  }
};

// const s3Driver = { async save() { /* upload to S3 / Supabase Storage, return its URL */ } };

const drivers = { local: localDriver };
const driver = drivers[config.storage.driver] || localDriver;

module.exports = {
  save: (...args) => driver.save(...args)
};
