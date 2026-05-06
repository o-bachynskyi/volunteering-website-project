const fs = require('fs/promises');
const path = require('path');
const { Client } = require('pg');
const pool = require('./db');
const { adminDbConfig, dbConfig } = require('./config');

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function ensureDatabaseExists() {
  const adminClient = new Client(adminDbConfig);

  try {
    await adminClient.connect();
    const existingDb = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbConfig.database]
    );

    if (!existingDb.rowCount) {
      await adminClient.query(`CREATE DATABASE ${quoteIdentifier(dbConfig.database)}`);
    }
  } finally {
    await adminClient.end();
  }
}

async function ensureSchemaExists() {
  const schemaPath = path.resolve(__dirname, '..', 'sql', 'schema.sql');
  const schemaSql = await fs.readFile(schemaPath, 'utf8');
  await pool.query(schemaSql);
}

async function initializeDatabase() {
  await ensureDatabaseExists();
  await ensureSchemaExists();
}

module.exports = {
  initializeDatabase,
};
