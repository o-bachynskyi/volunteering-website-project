  const pool = require('../db');
  const bcrypt = require('bcrypt');

  const registerUser = async (req, res) => {
    const { full_name, email, password, role_id } = req.body;

    try {
      // Перевірка чи такий email вже існує
      const checkUser = await pool.query(
        'SELECT * FROM "user" WHERE email = $1',
        [email]
      );

      if (checkUser.rows.length > 0) {
        return res.status(400).json({ message: 'Користувач з таким email вже існує' });
      }

      // Хешуємо пароль
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Додаємо користувача до бази
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

  module.exports = { registerUser };
