const pool = require('../db');

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

function resolveRoleFilter(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'military') return 2;
  if (normalized === 'militarys') return 2;
  if (normalized === 'volunteer') return 1;
  if (normalized === 'volunteers') return 1;
  return null;
}

function formatUser(row) {
  const roleCode = row.role_id === 2 ? 'mi' : 'vo';

  return {
    rnokpp: row.user_rnokpp,
    full_name: row.user_name || 'Користувач',
    role_id: row.role_id,
    role_name: row.role_name || (roleCode === 'mi' ? 'Військовий' : 'Волонтер'),
    role_code: roleCode,
    description: row.user_description || '',
    image_url: row.user_image_url || getDefaultAvatar(roleCode),
    tags: row.tags || [],
  };
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

module.exports = {
  fetchUsers,
};
