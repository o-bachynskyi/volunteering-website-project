const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
    host: 'localhost',
    database: 'volunteering_db',
    password: '542604',
    port: 5432,
});

async function testConnection() {
  try {
    // Виконати простий запит
    await pool.query('SELECT NOW()');
    console.log('Підключення до бази даних встановлено!');
  } catch (error) {
    console.error('Помилка підключення до БД:', error);
  }
}

testConnection();