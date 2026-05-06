const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const appConfig = {
  port: Number(process.env.PORT || 3000),
  publicDir: path.resolve(__dirname, '..', 'public'),
  rootDir: path.resolve(__dirname, '..'),
  sessionSecret: process.env.SESSION_SECRET || 'volunteering-website-dev-secret',
};

const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'lab-5.v2',
  password: process.env.DB_PASSWORD || '',
  port: Number(process.env.DB_PORT || 5432),
};

const adminDbConfig = {
  ...dbConfig,
  database: process.env.DB_ADMIN_NAME || 'postgres',
};

module.exports = {
  adminDbConfig,
  appConfig,
  dbConfig,
};
