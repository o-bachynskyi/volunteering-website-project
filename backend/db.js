const {Pool} = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'volunteering_db',
    password: '542604',
    port: 5432,
});

module.exports = pool;