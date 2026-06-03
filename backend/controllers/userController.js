const pool = require('../db');
const { readSessionPayload } = require('../session');
const { isAdmin } = require('../utils/admin');

async function ensureUserTagTableExists(client = pool) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_tag (
      user_rnokpp VARCHAR(32) NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (user_rnokpp, tag_id)
    )
  `);
}

function getDefaultAvatar(roleCode) {
  return roleCode === 'mi'
    ? '/public/images/account-icon.png'
    : '/public/images/premium_photo-1689568126014-06fea9d5d341.jpg';
}

function normalizeScalarId(value) {
  return String(value ?? '').trim();
}

function normalizeNumericId(value) {
  const normalized = Number(normalizeScalarId(value));
  return Number.isFinite(normalized) ? normalized : null;
}

function resolveRoleFilter(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'military') return 2;
  if (normalized === 'militarys') return 2;
  if (normalized === 'volunteer') return 1;
  if (normalized === 'volunteers') return 1;
  return null;
}

function formatUser(row) {
  const roleCode = normalizeNumericId(row.role_id) === 2 ? 'mi' : 'vo';

  return {
    rnokpp: normalizeScalarId(row.user_rnokpp),
    full_name: row.user_name || 'Користувач',
    role_id: normalizeNumericId(row.role_id) || row.role_id,
    role_name: row.role_name || (roleCode === 'mi' ? 'Військовий' : 'Волонтер'),
    role_code: roleCode,
    description: row.user_description || '',
    image_url: row.user_image_url || getDefaultAvatar(roleCode),
    tags: row.tags || [],
  };
}

function formatAdminUser(row) {
  const roleCode = normalizeNumericId(row.role_id) === 2 ? 'mi' : 'vo';

  return {
    rnokpp: normalizeScalarId(row.user_rnokpp),
    full_name: row.user_name || 'Користувач',
    email: row.user_email || '',
    role_id: normalizeNumericId(row.role_id) || row.role_id,
    role_name: row.role_name || (roleCode === 'mi' ? 'Військовий' : 'Волонтер'),
    role_code: roleCode,
    description: row.user_description || '',
    image_url: row.user_image_url || getDefaultAvatar(roleCode),
    tags: row.tags || [],
    postCount: Number(row.post_count || 0),
    responseCount: Number(row.response_count || 0),
    reportCount: Number(row.report_count || 0),
    isProtectedAdmin: isAdmin(row),
  };
}

async function getCurrentUser(req) {
  const session = readSessionPayload(req);
  if (!session?.rnokpp) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT u.*, r.role_name
      FROM app_user u
      LEFT JOIN role r ON r.role_id = u.role_id
      WHERE u.user_rnokpp = $1
    `,
    [session.rnokpp]
  );

  return result.rows[0] || null;
}

async function fetchUsers(req, res) {
  try {
    await ensureUserTagTableExists();

    const roleId = resolveRoleFilter(req.query.role);
    const params = [];
    let whereClause = '';

    if (roleId) {
      params.push(roleId);
      whereClause = `WHERE u.role_id = $${params.length}`;
    }

    const result = await pool.query(
      `
        SELECT
          u.user_rnokpp,
          u.user_name,
          u.user_description,
          u.user_image_url,
          u.role_id,
          r.role_name,
          COALESCE(array_remove(array_agg(DISTINCT t.tag_name), NULL), '{}') AS tags
        FROM app_user u
        LEFT JOIN role r ON r.role_id = u.role_id
        LEFT JOIN user_tag ut ON ut.user_rnokpp = u.user_rnokpp
        LEFT JOIN tag t ON t.tag_id = ut.tag_id
        ${whereClause}
        GROUP BY
          u.user_rnokpp,
          u.user_name,
          u.user_description,
          u.user_image_url,
          u.role_id,
          r.role_name
        ORDER BY u.user_name ASC, u.user_rnokpp ASC
      `,
      params
    );

    return res.status(200).json({
      users: result.rows.map(formatUser),
    });
  } catch (error) {
    console.error('Помилка завантаження користувачів:', error);
    return res.status(500).json({ message: 'Не вдалося завантажити користувачів.' });
  }
}

async function fetchUserByRnokpp(req, res) {
  try {
    await ensureUserTagTableExists();

    const rnokpp = normalizeScalarId(req.params.rnokpp);
    if (!rnokpp) {
      return res.status(400).json({ message: 'Некоректний ідентифікатор користувача.' });
    }

    const result = await pool.query(
      `
        SELECT
          u.user_rnokpp,
          u.user_name,
          u.user_description,
          u.user_image_url,
          u.role_id,
          r.role_name,
          COALESCE(array_remove(array_agg(DISTINCT t.tag_name), NULL), '{}') AS tags
        FROM app_user u
        LEFT JOIN role r ON r.role_id = u.role_id
        LEFT JOIN user_tag ut ON ut.user_rnokpp = u.user_rnokpp
        LEFT JOIN tag t ON t.tag_id = ut.tag_id
        WHERE u.user_rnokpp = $1
        GROUP BY
          u.user_rnokpp,
          u.user_name,
          u.user_description,
          u.user_image_url,
          u.role_id,
          r.role_name
        LIMIT 1
      `,
      [rnokpp]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Користувача не знайдено.' });
    }

    return res.status(200).json({ user: formatUser(result.rows[0]) });
  } catch (error) {
    console.error('Помилка завантаження профілю користувача:', error);
    return res.status(500).json({ message: 'Не вдалося завантажити профіль користувача.' });
  }
}

async function fetchAdminUsers(req, res) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ message: 'Потрібно увійти в систему.' });
    }

    if (!isAdmin(currentUser)) {
      return res.status(403).json({ message: 'Доступ дозволено лише адміністратору.' });
    }

    await ensureUserTagTableExists();

    const result = await pool.query(
      `
        SELECT
          u.user_rnokpp,
          u.user_name,
          u.user_email,
          u.user_description,
          u.user_image_url,
          u.role_id,
          r.role_name,
          COUNT(DISTINCT p.post_id)::int AS post_count,
          COUNT(DISTINCT rsp.response_id)::int AS response_count,
          COUNT(DISTINCT rpt.report_number)::int AS report_count,
          COALESCE(array_remove(array_agg(DISTINCT t.tag_name), NULL), '{}') AS tags
        FROM app_user u
        LEFT JOIN role r ON r.role_id = u.role_id
        LEFT JOIN user_tag ut ON ut.user_rnokpp = u.user_rnokpp
        LEFT JOIN tag t ON t.tag_id = ut.tag_id
        LEFT JOIN post p ON p.user_rnokpp = u.user_rnokpp
        LEFT JOIN response rsp ON rsp.user_rnokpp = u.user_rnokpp
        LEFT JOIN report rpt ON rpt.user_rnokpp = u.user_rnokpp
        GROUP BY
          u.user_rnokpp,
          u.user_name,
          u.user_email,
          u.user_description,
          u.user_image_url,
          u.role_id,
          r.role_name
        ORDER BY u.user_name ASC, u.user_rnokpp ASC
      `
    );

    return res.status(200).json({
      users: result.rows.map(formatAdminUser),
    });
  } catch (error) {
    console.error('Помилка завантаження списку користувачів для адміністратора:', error);
    return res.status(500).json({ message: 'Не вдалося завантажити список користувачів.' });
  }
}

async function deleteUser(req, res) {
  const userRnokpp = String(req.params.userRnokpp || '').trim();
  if (!/^\d{10}$/.test(userRnokpp)) {
    return res.status(400).json({ message: 'Некоректний ідентифікатор користувача.' });
  }

  const client = await pool.connect();

  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ message: 'Потрібно увійти в систему.' });
    }

    if (!isAdmin(currentUser)) {
      return res.status(403).json({ message: 'Доступ дозволено лише адміністратору.' });
    }

    if (currentUser.user_rnokpp === userRnokpp) {
      return res.status(400).json({ message: 'Адміністратор не може видалити власний обліковий запис.' });
    }

    await client.query('BEGIN');
    await ensureUserTagTableExists(client);

    const userResult = await client.query(
      `
        SELECT u.*, r.role_name
        FROM app_user u
        LEFT JOIN role r ON r.role_id = u.role_id
        WHERE u.user_rnokpp = $1
      `,
      [userRnokpp]
    );

    const targetUser = userResult.rows[0];
    if (!targetUser) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Користувача не знайдено.' });
    }

    if (isAdmin(targetUser)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Неможливо видалити адміністратора системи.' });
    }

    const linkedActivityResult = await client.query(
      `
        SELECT
          (SELECT COUNT(*)::int FROM post WHERE user_rnokpp = $1) AS post_count,
          (SELECT COUNT(*)::int FROM response WHERE user_rnokpp = $1) AS response_count,
          (SELECT COUNT(*)::int FROM report WHERE user_rnokpp = $1) AS report_count
      `,
      [userRnokpp]
    );

    const postCount = Number(linkedActivityResult.rows[0]?.post_count || 0);
    const responseCount = Number(linkedActivityResult.rows[0]?.response_count || 0);
    const reportCount = Number(linkedActivityResult.rows[0]?.report_count || 0);

    if (postCount > 0 || responseCount > 0 || reportCount > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'Не можна видалити користувача, якщо з ним уже пов’язані дописи, відгуки або звіти.',
      });
    }

    await client.query('DELETE FROM user_tag WHERE user_rnokpp = $1', [userRnokpp]);
    await client.query('DELETE FROM app_user WHERE user_rnokpp = $1', [userRnokpp]);

    await client.query('COMMIT');
    return res.status(200).json({ message: 'Користувача видалено.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Помилка видалення користувача:', error);
    return res.status(500).json({ message: 'Не вдалося видалити користувача.' });
  } finally {
    client.release();
  }
}

module.exports = {
  deleteUser,
  fetchAdminUsers,
  fetchUsers,
  fetchUserByRnokpp,
};
