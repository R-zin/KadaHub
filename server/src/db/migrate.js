const fs = require('fs');
const path = require('path');
const { pool } = require('./index');

const run = async () => {
  const file = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(file, 'utf8');
  try {
    console.log('Running migrations from', file);
    await pool.query(sql);
    console.log('Migrations applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
