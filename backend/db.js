const {Pool} = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'lab-5.v2',
    password: '542604',
    port: 5432,
});

module.exports = pool;