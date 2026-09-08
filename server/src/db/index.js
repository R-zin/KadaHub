const { Pool } = require('pg');
const config = require('../config');

// Supabase requires TLS; for a local Postgres you can set DB_SSL=false.
const ssl = config.dbSsl && config.databaseUrl.includes('supabase')
  ? { rejectUnauthorized: false }
  : config.dbSsl && config.databaseUrl.startsWith('postgres') && !config.databaseUrl.includes('localhost')
    ? { rejectUnauthorized: false }
    : false;

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: ssl || undefined,
  max: 10,
  idleTimeoutMillis: 30000
});

/** Run a single parameterized query. */
const query = (text, params) => pool.query(text, params);

/** Get a client (for transactions). Remember to release(). */
const getClient = () => pool.connect();

/**
 * Run fn inside a transaction. fn receives a client whose .query is used for
 * all statements. Commits on success, rolls back on any throw.
 */
const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, query, getClient, withTransaction };
