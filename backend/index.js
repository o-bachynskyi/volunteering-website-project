const express = require('express');
const path = require('path');
const pool = require('./db');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = 3000;

app.use('/public', express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.redirect('/public/pages/index.html');
});

app.use(express.json());

app.use('/auth', authRoutes);

app.listen(PORT, async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log(`Підключення до БД успішне. Сервер запущено на http://localhost:${PORT}`);
  } catch (err) {
    console.error('Не вдалося підключитись до БД:', err);
  }
});
