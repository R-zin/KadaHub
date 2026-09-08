const app = require('./app');
const config = require('./config');
const { pool } = require('./db');

const start = async () => {
  try {
    // Fail fast if the database is unreachable.
    await pool.query('SELECT 1');
    app.listen(config.port, () => {
      console.log(`KadaHub API listening on http://localhost:${config.port} (env: ${config.env})`);
    });
  } catch (err) {
    console.error('Failed to connect to the database. Check DATABASE_URL in .env');
    console.error(err.message);
    process.exit(1);
  }
};

start();
