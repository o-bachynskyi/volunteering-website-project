const bcrypt = require('bcrypt');
const pool = require('../db');
const {
  clearSessionCookie,
  createSessionToken,
  readSessionPayload,
  setSessionCookie,
} = require('../session');

const ROLE_CONFIG = {
  vo: { id: 1, code: 'vo', name: 'Волонтер' },
  mi: { id: 2, code: 'mi', name: 'Військовий' },
};

const ROLE_BY_ID = Object.fromEntries(
  Object.values(ROLE_CONFIG).map((role) => [role.id, role])
);

async function ensureRolesExist() {
  await pool.query(
    `
      INSERT INTO role (role_id, role_name)
      VALUES ($1, $2), ($3, $4)
      ON CONFLICT (role_id) DO UPDATE
      SET role_name = EXCLUDED.role_name
    `,
    [
      ROLE_CONFIG.vo.id,
      ROLE_CONFIG.vo.name,
      ROLE_CONFIG.mi.id,
      ROLE_CONFIG.mi.name,
    ]
  );
}

function resolveRole(roleId) {
  if (typeof roleId === 'number') {
    return ROLE_BY_ID[roleId] || null;
  }

  if (typeof roleId === 'string') {
    const normalizedRole = roleId.trim().toLowerCase();
    return ROLE_CONFIG[normalizedRole] || ROLE_BY_ID[Number(normalizedRole)] || null;
  }

  return null;
}

function normalizeUser(user) {
  const role = ROLE_BY_ID[user.role_id] || {
    id: user.role_id,
    code: null,
    name: user.role_name || 'Невідома роль',
  };

  return {
    id: user.user_rnokpp,
    rnokpp: user.user_rnokpp,
    full_name: user.user_name,
    email: user.user_email,
    role_id: role.id,
    role_code: role.code,
    role_name: role.name,
    description: user.user_description || '',
    image_url: user.user_image_url || '',
  };
}

async function findUserByEmail(email) {
  const result = await pool.query(
    `
      SELECT u.*, r.role_name
      FROM app_user u
      LEFT JOIN role r ON r.role_id = u.role_id
      WHERE LOWER(u.user_email) = LOWER($1)
    `,
    [email]
  );

  return result.rows[0] || null;
}

async function findUserByRnokpp(rnokpp) {
  const result = await pool.query(
    `
      SELECT u.*, r.role_name
      FROM app_user u
      LEFT JOIN role r ON r.role_id = u.role_id
      WHERE u.user_rnokpp = $1
    `,
    [rnokpp]
  );

  return result.rows[0] || null;
}

async function getAuthenticatedUser(req) {
  const session = readSessionPayload(req);
  if (!session?.rnokpp) {
    return null;
  }

  return findUserByRnokpp(session.rnokpp);
}

function validateRegistrationPayload({ full_name, email, password, rnokpp, role_id }) {
  if (!full_name?.trim()) {
    return 'Вкажіть імʼя або назву профілю.';
  }

  if (!email?.trim()) {
    return 'Вкажіть електронну пошту.';
  }

  if (!password || password.length < 8) {
    return 'Пароль має містити щонайменше 8 символів.';
  }

  if (!/^\d{10}$/.test(String(rnokpp || '').trim())) {
    return 'РНОКПП має містити 10 цифр.';
  }

  if (!resolveRole(role_id)) {
    return 'Оберіть коректну роль.';
  }

  return null;
}

async function registerUser(req, res) {
  const { full_name, email, password, role_id, rnokpp } = req.body;
  const validationError = validateRegistrationPayload({
    full_name,
    email,
    password,
    role_id,
    rnokpp,
  });

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedRnokpp = String(rnokpp).trim();
  const role = resolveRole(role_id);

  try {
    await ensureRolesExist();

    const existingByEmail = await findUserByEmail(normalizedEmail);
    if (existingByEmail) {
      return res.status(409).json({ message: 'Користувач з такою електронною поштою вже існує.' });
    }

    const existingByRnokpp = await findUserByRnokpp(normalizedRnokpp);
    if (existingByRnokpp) {
      return res.status(409).json({ message: 'Користувач з таким РНОКПП вже існує.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
        INSERT INTO app_user (
          user_rnokpp,
          role_id,
          user_name,
          user_email,
          password_hash,
          user_description,
          user_image_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        normalizedRnokpp,
        role.id,
        full_name.trim(),
        normalizedEmail,
        passwordHash,
        '',
        '',
      ]
    );

    const createdUser = {
      ...result.rows[0],
      role_name: role.name,
    };

    setSessionCookie(res, createSessionToken(createdUser));

    return res.status(201).json({
      message: 'Реєстрація успішна.',
      user: normalizeUser(createdUser),
    });
  } catch (error) {
    console.error('Помилка реєстрації:', error);
    return res.status(500).json({ message: 'Не вдалося зареєструвати користувача.' });
  }
}

async function loginUser(req, res) {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return res.status(400).json({ message: 'Вкажіть email і пароль.' });
  }

  try {
    await ensureRolesExist();

    const user = await findUserByEmail(email.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({ message: 'Користувача з таким email не знайдено.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash || '');
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Невірний пароль.' });
    }

    setSessionCookie(res, createSessionToken(user));

    return res.status(200).json({
      message: 'Вхід успішний.',
      user: normalizeUser(user),
    });
  } catch (error) {
    console.error('Помилка входу:', error);
    return res.status(500).json({ message: 'Не вдалося виконати вхід.' });
  }
}

async function getSessionUser(req, res) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ message: 'Сесію не знайдено.' });
    }

    return res.status(200).json({ user: normalizeUser(user) });
  } catch (error) {
    console.error('Помилка перевірки сесії:', error);
    return res.status(500).json({ message: 'Не вдалося перевірити сесію.' });
  }
}

async function getUserProfile(req, res) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ message: 'Потрібно увійти в систему.' });
    }

    return res.status(200).json({ user: normalizeUser(user) });
  } catch (error) {
    console.error('Помилка отримання профілю:', error);
    return res.status(500).json({ message: 'Не вдалося завантажити профіль.' });
  }
}

function logoutUser(req, res) {
  clearSessionCookie(res);
  return res.status(200).json({ message: 'Ви вийшли з акаунта.' });
}

module.exports = {
  getSessionUser,
  getUserProfile,
  loginUser,
  logoutUser,
  registerUser,
};
