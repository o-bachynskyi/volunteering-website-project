const pool = require('../db');
const bcrypt = require('bcrypt');

const registerUser = async (req, res) => {
  const { full_name, email, password, role_id } = req.body;

  try {
    const checkUser = await pool.query(
      'SELECT * FROM "user" WHERE email = $1',
      [email]
    );

    if (checkUser.rows.length > 0) {
      return res.status(400).json({ message: 'Користувач з таким email вже існує' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO "user" (user_id, full_name, email, password, role_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
      [full_name, email, hashedPassword, role_id]
    );

    res.status(201).json({ message: 'Користувач успішно зареєстрований' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const userResult = await pool.query(
      'SELECT * FROM "user" WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Користувача не знайдено' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Невірний пароль' });
    }

    res.status(200).json({
      message: 'Вхід успішний',
      user: {
        id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role_id: user.role_id,
      }
    });
  } catch (err) {
    console.error('Помилка під час входу:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

const getUserProfile = async (req, res) => {
  const { id } = req.query; // Правильно: очікуємо ID

  try {
    const result = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, r.name AS role
       FROM "user" u
       JOIN role r ON u.role_id = r.role_id
       WHERE u.user_id = $1`, // Виправлено: user_id замість email
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Користувача не знайдено' });
    }

    res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error('Помилка отримання профілю:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

module.exports = { registerUser, loginUser, getUserProfile };
