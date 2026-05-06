const pool = require('../backend/db');
const { initializeDatabase } = require('../backend/initDb');

async function main() {
  await initializeDatabase();
  console.log('Database is ready.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
