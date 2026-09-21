const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

/**
 * Storage service interface.
 *   save(buffer, { ext, folder, contentType, fileName }) -> { url }
 *   delete(urlOrPath) -> boolean
 * Swap the driver with STORAGE_DRIVER. Implementations: local (dev), supabase (prod).
 */

let supabaseClient = null;
const getSupabase = () => {
  if (!supabaseClient) {
    const { createClient } = require('@supabase/supabase-js');
    if (!config.storage.supabaseUrl || !config.storage.supabaseServiceRoleKey) {
      throw new Error('Supabase storage credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are not configured');
    }
    supabaseClient = createClient(config.storage.supabaseUrl, config.storage.supabaseServiceRoleKey, {
      auth: { persistSession: false }
    });
  }
  return supabaseClient;
};

const supabaseDriver = {
  async save(buffer, { ext = '.jpg', folder = 'products', contentType = 'image/jpeg', fileName } = {}) {
    const supabase = getSupabase();
    const bucket = config.storage.supabaseBucket || 'product-images';
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
    const cleanExt = ext.startsWith('.') ? ext : `.${ext}`;
    const secureName = fileName || `${crypto.randomUUID()}${cleanExt}`;
    const filePath = `${cleanFolder}/${secureName}`;

    const { data, error } = await supabase.storage.from(bucket).upload(filePath, buffer, {
      contentType,
      upsert: false
    });

    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return { url: publicData.publicUrl, path: filePath };
  },

  async delete(urlOrPath) {
    if (!urlOrPath) return false;
    try {
      const supabase = getSupabase();
      const bucket = config.storage.supabaseBucket || 'product-images';

      // Extract relative object path
      let objectPath = urlOrPath;
      if (urlOrPath.includes(`${bucket}/`)) {
        objectPath = urlOrPath.split(`${bucket}/`)[1];
      } else if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
        const u = new URL(urlOrPath);
        const parts = u.pathname.split(`/${bucket}/`);
        if (parts.length > 1) objectPath = parts[1];
      }

      const { error } = await supabase.storage.from(bucket).remove([objectPath]);
      if (error) {
        throw new Error(`Supabase delete error: ${error.message}`);
      }
      return true;
    } catch {
      return false;
    }
  }
};

const localDriver = {
  async save(buffer, { ext = '.bin', folder = 'misc', fileName } = {}) {
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
    const dir = path.join(process.cwd(), config.storage.uploadDir, cleanFolder);
    await fs.promises.mkdir(dir, { recursive: true });

    const cleanExt = ext.startsWith('.') ? ext : `.${ext}`;
    const secureName = fileName || `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${cleanExt}`;
    const filePath = path.join(dir, secureName);

    // Verify target path does not escape the upload directory
    const resolvedDir = path.resolve(process.cwd(), config.storage.uploadDir);
    if (!path.resolve(filePath).startsWith(resolvedDir)) {
      throw new Error('Invalid destination path traversal detected');
    }

    await fs.promises.writeFile(filePath, buffer);
    return { url: `/${config.storage.uploadDir}/${cleanFolder}/${secureName}`, path: filePath };
  },

  async delete(urlOrPath) {
    if (!urlOrPath) return false;
    try {
      const uploadPrefix = `/${config.storage.uploadDir}/`;
      let rel = urlOrPath;
      if (urlOrPath.includes(uploadPrefix)) {
        rel = urlOrPath.split(uploadPrefix)[1];
      } else if (urlOrPath.startsWith(config.storage.uploadDir)) {
        rel = urlOrPath.replace(new RegExp(`^${config.storage.uploadDir}[\\\\/]+`), '');
      }

      const baseDir = path.resolve(process.cwd(), config.storage.uploadDir);
      const targetPath = path.resolve(baseDir, rel);

      // Strict path traversal guard
      if (!targetPath.startsWith(baseDir)) {
        throw new Error('Security Error: Path traversal attempt prevented in storage delete');
      }

      await fs.promises.unlink(targetPath);
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') return false; // File already deleted or does not exist
      throw err;
    }
  },

  /**
   * Safely deletes expired temporary files older than maxAgeMs from tryon-temp.
   * Never touches permanent product files.
   */
  async cleanExpiredTempFiles(maxAgeMs = 30 * 60 * 1000) {
    const tempDir = path.join(process.cwd(), config.storage.uploadDir, 'tryon-temp');
    let deletedCount = 0;
    try {
      const entries = await fs.promises.readdir(tempDir, { withFileTypes: true });
      const now = Date.now();
      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(tempDir, entry.name);
          try {
            const stat = await fs.promises.stat(filePath);
            if (now - stat.mtimeMs > maxAgeMs) {
              await fs.promises.unlink(filePath);
              deletedCount++;
            }
          } catch {
            // Ignore race conditions
          }
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // Diagnostic log without secrets
        console.error('[storageService] cleanExpiredTempFiles error:', err.message);
      }
    }
    return { deletedCount };
  }
};

const drivers = { local: localDriver, supabase: supabaseDriver };
const driver = drivers[config.storage.driver] || localDriver;

module.exports = {
  save: (...args) => driver.save(...args),
  delete: (...args) => driver.delete(...args),
  cleanExpiredTempFiles: (maxAgeMs) => (driver.cleanExpiredTempFiles ? driver.cleanExpiredTempFiles(maxAgeMs) : Promise.resolve({ deletedCount: 0 })),
  supabaseDriver,
  localDriver,
  getDriverName: () => config.storage.driver
};
