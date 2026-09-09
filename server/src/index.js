const app = require('./app');
const config = require('./config');
const { initializeDatabase } = require('./db/init');

const start = async () => {
  try {
    // Create the schema (and seed a fresh database) before serving requests.
    await initializeDatabase();
    app.listen(config.port, () => {
      console.log(`KadaHub API listening on http://localhost:${config.port} (env: ${config.env})`);
    });
  } catch (err) {
    console.error('Failed to initialize the database. Check DATABASE_URL in .env');
    console.error(err.message);
    process.exit(1);
  }
};

start();
