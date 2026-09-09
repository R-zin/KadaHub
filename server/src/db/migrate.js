const { pool } = require('./index');
const { applySchema } = require('./init');

const run = async () => {
  try {
    const file = await applySchema();
    console.log('Migrations applied successfully from', file);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
