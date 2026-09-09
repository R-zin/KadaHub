/**
 * Initialize the database at server startup.
 *
 * - Applies src/db/schema.sql every boot. The schema is idempotent
 *   (CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION, ...), so re-running
 *   it against an existing Supabase/Postgres database is a safe no-op.
 * - Seeds demo data only when the database is empty (fresh Supabase project),
 *   unless SEED_ON_INIT forces it on/off:
 *     SEED_ON_INIT=true   always seed on boot (seed truncates domain tables first)
 *     SEED_ON_INIT=false  never seed on boot, only create the schema
 *     (unset)             seed only if the users table has no rows
 *
 * Set DB_INIT=false to skip initialization entirely (e.g. for read-only roles).
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('./index');

const bool = (v) => ['1', 'true', 'yes', 'on'].includes(String(v || '').toLowerCase());

const applySchema = async () => {
  const file = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(file, 'utf8');
  await pool.query(sql);
  return file;
};

const shouldSeed = async () => {
  const flag = process.env.SEED_ON_INIT;
  if (flag !== undefined && flag !== '') return bool(flag);
  // Auto: seed only a fresh/empty database so we never wipe existing data.
  const { rows } = await pool.query('SELECT 1 FROM users LIMIT 1');
  return rows.length === 0;
};

const initializeDatabase = async () => {
  if (String(process.env.DB_INIT).toLowerCase() === 'false') {
    console.log('[db-init] DB_INIT=false — skipping database initialization');
    return;
  }

  // Fail fast if the database is unreachable (the old index.js behavior).
  await pool.query('SELECT 1');

  const file = await applySchema();
  console.log(`[db-init] schema applied from ${file}`);

  if (await shouldSeed()) {
    console.log('[db-init] seeding demo data (empty database or SEED_ON_INIT=true)...');
    // Lazy require so migrate-only / DB_INIT=false runs never pull bcrypt.
    const { seedDatabase } = require('./seed');
    await seedDatabase();
  } else {
    console.log('[db-init] existing data found — skipping seed');
  }
};

module.exports = { initializeDatabase, applySchema };
