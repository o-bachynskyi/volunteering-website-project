const express = require('express');
const path = require('path');
const pool = require('./db');
const { appConfig } = require('./config');
const { initializeDatabase } = require('./initDb');
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const reportRoutes = require('./routes/reports');
const responseRoutes = require('./routes/responses');
const userRoutes = require('./routes/users');

const app = express();
const PORT = appConfig.port;
const publicDir = appConfig.publicDir;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/public', express.static(publicDir));
app.use('/auth', authRoutes);
app.use('/posts', postRoutes);
app.use('/reports', reportRoutes);
app.use('/responses', responseRoutes);
app.use('/users', userRoutes);

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('РџРѕРјРёР»РєР° РїРµСЂРµРІС–СЂРєРё Р‘Р”:', error);
    res.status(500).json({ ok: false });
  }
});

app.get('/', (req, res) => {
  res.redirect('/public/pages/index.html');
});

app.get('/public/pages/index.html', (req, res) => {
  res.sendFile(path.join(publicDir, 'pages', 'index.html'));
});

async function startServer() {
  try {
    await initializeDatabase();
    await pool.query('SELECT NOW()');
    console.log(`Server is running at http://localhost:${PORT}`);
    return app.listen(PORT);
  } catch (error) {
    console.error('РќРµ РІРґР°Р»РѕСЃСЏ РїС–РґРєР»СЋС‡РёС‚РёСЃСЏ РґРѕ PostgreSQL:', error);
    throw error;
  }
}

if (require.main === module) {
  startServer().catch(() => {
    process.exitCode = 1;
  });
}

module.exports = {
  app,
  startServer,
};
