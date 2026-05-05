const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'lab-5.v2',
  password: process.env.DB_PASSWORD || '542604',
  port: Number(process.env.DB_PORT || 5432),
});

module.exports = pool;
