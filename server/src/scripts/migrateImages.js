const fs = require('fs');
const path = require('path');
const { pool } = require('../db');
const storageService = require('../services/storageService');

/**
 * Image Migration Utility: Migrates local /uploads/ images to Supabase Storage
 * and updates database URLs in the product_images table.
 */
const migrateImagesToSupabase = async () => {
  console.log('Scanning product_images for local uploads...');
  const { rows } = await pool.query(
    "SELECT id, url FROM product_images WHERE url LIKE '/uploads/%' OR url LIKE 'uploads/%'"
  );

  console.log(`Found ${rows.length} local image(s) to migrate.`);
  if (rows.length === 0) {
    console.log('No local images found in product_images. All images are already using cloud/external URLs.');
    return { scanned: 0, migrated: 0 };
  }

  let migrated = 0;
  for (const row of rows) {
    const cleanUrl = row.url.replace(/^\//, '');
    const localFilePath = path.join(process.cwd(), cleanUrl);

    if (!fs.existsSync(localFilePath)) {
      console.warn(`[WARN] Local file not found on disk: ${localFilePath}`);
      continue;
    }

    try {
      const buffer = fs.readFileSync(localFilePath);
      const ext = path.extname(localFilePath) || '.jpg';
      const { url: cloudUrl } = await storageService.supabaseDriver.save(buffer, {
        ext,
        folder: 'products'
      });

      await pool.query('UPDATE product_images SET url = $1 WHERE id = $2', [cloudUrl, row.id]);
      console.log(`[SUCCESS] Migrated image ID ${row.id}: ${row.url} -> ${cloudUrl}`);
      migrated++;
    } catch (err) {
      console.error(`[ERROR] Failed to migrate image ID ${row.id}:`, err.message);
    }
  }

  console.log(`Migration finished: ${migrated} of ${rows.length} image(s) migrated successfully.`);
  return { scanned: rows.length, migrated };
};

if (require.main === module) {
  migrateImagesToSupabase()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Fatal migration error:', err);
      pool.end();
    });
}

module.exports = { migrateImagesToSupabase };
