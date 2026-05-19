const { Pool } = require('pg');

function createPoolConfig() {
    if (process.env.DATABASE_URL) {
        return {
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false,
            },
        };
    }

    return {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'lab-5.v2',
        password: process.env.DB_PASSWORD || '542604',
        port: Number(process.env.DB_PORT || 5432),
    };
}

const pool = new Pool(createPoolConfig());

module.exports = pool;
