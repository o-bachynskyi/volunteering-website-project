require('dotenv').config();

const express = require('express');
const path = require('path');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const reportRoutes = require('./routes/reports');
const responseRoutes = require('./routes/responses');
const userRoutes = require('./routes/users');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const appShellPath = path.join(publicDir, 'pages', 'index.html');
const appPages = new Set([
  'requests',
  'accepted-requests',
  'reports',
  'military',
  'volunteers',
  'admin',
]);

async function ensureImageColumnsSupportLongValues() {
  const statements = [
    `ALTER TABLE IF EXISTS app_user ALTER COLUMN user_image_url TYPE TEXT`,
    `ALTER TABLE IF EXISTS post_image ALTER COLUMN post_image_url TYPE TEXT`,
    `ALTER TABLE IF EXISTS response_image ALTER COLUMN response_image_url TYPE TEXT`,
    `ALTER TABLE IF EXISTS report_image ALTER COLUMN report_image_url TYPE TEXT`,
  ];

  for (const statement of statements) {
    await pool.query(statement);
  }
}

app.use(express.json({ limit: '15mb' }));
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
    console.error('Помилка перевірки БД:', error);
    res.status(500).json({ ok: false });
  }
});

app.get('/', (req, res) => {
  res.redirect('/public/pages/index.html');
});

app.get('/public/pages/index.html', (req, res) => {
  res.sendFile(appShellPath);
});

app.get('/public/:page.html', (req, res, next) => {
  if (!appPages.has(req.params.page)) {
    return next();
  }

  res.sendFile(appShellPath);
});

app.listen(PORT, async () => {
  try {
    await pool.query('SELECT NOW()');
    await ensureImageColumnsSupportLongValues();
    console.log(`Server is running at http://localhost:${PORT}`);
  } catch (error) {
    console.error('Не вдалося підключитися до PostgreSQL:', error);
  }
});
