const pool = require('../db');
const { readSessionPayload } = require('../session');
const { isAdmin } = require('../utils/admin');
const { normalizeImageList } = require('../utils/imageValidation');

const REPORT_TITLES = {
  author: 'Звіт про отримання допомоги',
  helper: 'Звіт про надання допомоги',
};

function normalizeScalarId(value) {
  return String(value ?? '').trim();
}

function normalizeImages(images) {
  return normalizeImageList(images);
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

async function getNextId(client, tableName, idColumn) {
  const result = await client.query(
    `
      SELECT COALESCE(
        MAX(
          NULLIF(
            regexp_replace(TRIM(CAST(${idColumn} AS text)), '\\D', '', 'g'),
            ''
          )::bigint
        ),
        0
      ) + 1 AS next_id
      FROM ${tableName}
    `
  );
  return Number(result.rows[0].next_id);
}

async function ensureResponseStatusColumn(client = pool) {
  await client.query(`
    ALTER TABLE response
    ADD COLUMN IF NOT EXISTS response_status TEXT DEFAULT 'open'
  `);
}

function formatReport(row) {
  return {
    reportId: normalizeScalarId(row.report_number),
    requestId: normalizeScalarId(row.post_id),
    responseId: row.response_id ? normalizeScalarId(row.response_id) : '',
    reporterRole: row.report_type || 'author',
    reporterUserRole: row.user_role_name || (row.report_type === 'author' ? 'Військовий' : 'Волонтер'),
    reportTitle: REPORT_TITLES[row.report_type] || 'Звіт',
    text: row.report_text || '',
    images: row.images || [],
    createdAt: row.creation_datetime ? new Date(row.creation_datetime).getTime() : Date.now(),
    createdAtIso: row.creation_datetime ? new Date(row.creation_datetime).toISOString() : new Date().toISOString(),
    requestSnapshot: {
      title: row.post_title || 'Без назви запиту',
      description: row.post_description || '',
      authorName: row.request_author_name || 'Невідомо',
      authorRole: row.request_author_role || '',
      dateText: row.post_datetime ? new Date(row.post_datetime).toISOString() : '',
      images: row.request_images || [],
      tags: row.request_tags || [],
    },
  };
}

function formatAdminReport(row) {
  const requestAuthorRole = row.request_author_role || '';
  const reporterUserRole = row.user_role_name || (row.report_type === 'author' ? 'Військовий' : 'Волонтер');

  return {
    reportId: normalizeScalarId(row.report_number),
    requestId: normalizeScalarId(row.post_id),
    responseId: row.response_id ? normalizeScalarId(row.response_id) : '',
    reporterId: normalizeScalarId(row.user_rnokpp),
    reporterName: row.reporter_user_name || 'Користувач',
    reporterRole: row.report_type || 'author',
    reporterUserRole,
    reportTitle: REPORT_TITLES[row.report_type] || 'Звіт',
    text: row.report_text || '',
    images: row.images || [],
    createdAt: row.creation_datetime ? new Date(row.creation_datetime).getTime() : Date.now(),
    createdAtIso: row.creation_datetime ? new Date(row.creation_datetime).toISOString() : new Date().toISOString(),
    requestSnapshot: {
      title: row.post_title || 'Без назви запиту',
      description: row.post_description || '',
      authorName: row.request_author_name || 'Невідомо',
      authorRole: requestAuthorRole,
      dateText: row.post_datetime ? new Date(row.post_datetime).toISOString() : '',
      images: row.request_images || [],
      tags: row.request_tags || [],
    },
  };
}

async function fetchMyReports(req, res) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ message: 'Потрібно увійти в систему.' });
    }

    await ensureResponseStatusColumn();

    const result = await pool.query(
      `
        SELECT
          rpt.report_number,
          rpt.post_id,
          rpt.report_type,
          rpt.report_text,
          rpt.creation_datetime,
          p.post_title,
          p.post_description,
          p.post_datetime,
          request_author.user_name AS request_author_name,
          request_author_role.role_name AS request_author_role,
          reporter_role.role_name AS user_role_name,
          helper_response.response_id,
          COALESCE(array_remove(array_agg(DISTINCT report_image.report_image_url), NULL), '{}') AS images,
          COALESCE(array_remove(array_agg(DISTINCT request_image.post_image_url), NULL), '{}') AS request_images,
          COALESCE(array_remove(array_agg(DISTINCT request_tag.tag_name), NULL), '{}') AS request_tags
        FROM report rpt
        LEFT JOIN post p ON p.post_id = rpt.post_id
        LEFT JOIN app_user request_author ON request_author.user_rnokpp = p.user_rnokpp
        LEFT JOIN role request_author_role ON request_author_role.role_id = request_author.role_id
        LEFT JOIN app_user reporter_user ON reporter_user.user_rnokpp = rpt.user_rnokpp
        LEFT JOIN role reporter_role ON reporter_role.role_id = reporter_user.role_id
        LEFT JOIN response helper_response
          ON helper_response.user_rnokpp = rpt.user_rnokpp
          AND helper_response.post_id = rpt.post_id
        LEFT JOIN report_image ON report_image.report_number = rpt.report_number
        LEFT JOIN post_image request_image ON request_image.post_id = p.post_id
        LEFT JOIN post_tag request_post_tag ON request_post_tag.post_id = p.post_id
        LEFT JOIN tag request_tag ON request_tag.tag_id = request_post_tag.tag_id
        WHERE rpt.user_rnokpp = $1
        GROUP BY
          rpt.report_number,
          rpt.post_id,
          rpt.report_type,
          rpt.report_text,
          rpt.creation_datetime,
          p.post_title,
          p.post_description,
          p.post_datetime,
          request_author.user_name,
          request_author_role.role_name,
          reporter_role.role_name,
          helper_response.response_id
        ORDER BY rpt.creation_datetime DESC NULLS LAST, rpt.report_number DESC
      `,
      [currentUser.user_rnokpp]
    );

    return res.status(200).json({
      reports: result.rows.map(formatReport),
    });
  } catch (error) {
    console.error('Помилка завантаження звітів:', error);
    return res.status(500).json({ message: 'Не вдалося завантажити звіти.' });
  }
}

async function fetchAdminReports(req, res) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ message: 'Потрібно увійти в систему.' });
    }

    if (!isAdmin(currentUser)) {
      return res.status(403).json({ message: 'Доступ дозволено лише адміністратору.' });
    }

    await ensureResponseStatusColumn();

    const result = await pool.query(
      `
        SELECT
          rpt.report_number,
          rpt.user_rnokpp,
          rpt.post_id,
          rpt.report_type,
          rpt.report_text,
          rpt.creation_datetime,
          p.post_title,
          p.post_description,
          p.post_datetime,
          request_author.user_name AS request_author_name,
          request_author_role.role_name AS request_author_role,
          reporter_user.user_name AS reporter_user_name,
          reporter_role.role_name AS user_role_name,
          helper_response.response_id,
          COALESCE(array_remove(array_agg(DISTINCT report_image.report_image_url), NULL), '{}') AS images,
          COALESCE(array_remove(array_agg(DISTINCT request_image.post_image_url), NULL), '{}') AS request_images,
          COALESCE(array_remove(array_agg(DISTINCT request_tag.tag_name), NULL), '{}') AS request_tags
        FROM report rpt
        LEFT JOIN post p ON p.post_id = rpt.post_id
        LEFT JOIN app_user request_author ON request_author.user_rnokpp = p.user_rnokpp
        LEFT JOIN role request_author_role ON request_author_role.role_id = request_author.role_id
        LEFT JOIN app_user reporter_user ON reporter_user.user_rnokpp = rpt.user_rnokpp
        LEFT JOIN role reporter_role ON reporter_role.role_id = reporter_user.role_id
        LEFT JOIN response helper_response
          ON helper_response.user_rnokpp = rpt.user_rnokpp
          AND helper_response.post_id = rpt.post_id
        LEFT JOIN report_image ON report_image.report_number = rpt.report_number
        LEFT JOIN post_image request_image ON request_image.post_id = p.post_id
        LEFT JOIN post_tag request_post_tag ON request_post_tag.post_id = p.post_id
        LEFT JOIN tag request_tag ON request_tag.tag_id = request_post_tag.tag_id
        GROUP BY
          rpt.report_number,
          rpt.user_rnokpp,
          rpt.post_id,
          rpt.report_type,
          rpt.report_text,
          rpt.creation_datetime,
          p.post_title,
          p.post_description,
          p.post_datetime,
          request_author.user_name,
          request_author_role.role_name,
          reporter_user.user_name,
          reporter_role.role_name,
          helper_response.response_id
        ORDER BY rpt.creation_datetime DESC NULLS LAST, rpt.report_number DESC
      `
    );

    return res.status(200).json({
      reports: result.rows.map(formatAdminReport),
    });
  } catch (error) {
    console.error('Помилка завантаження звітів для адміністратора:', error);
    return res.status(500).json({ message: 'Не вдалося завантажити звіти.' });
  }
}

async function createReport(req, res) {
  const postId = Number(req.body.post_id);
  const responseId = req.body.response_id == null || req.body.response_id === ''
    ? null
    : Number(req.body.response_id);
  const reporterRole = String(req.body.reporter_role || '').trim().toLowerCase();
  const reportText = String(req.body.text || '').trim();
  const images = normalizeImages(req.body.images);

  if (!Number.isInteger(postId)) {
    return res.status(400).json({ message: 'Некоректний запит.' });
  }

  if (!['author', 'helper'].includes(reporterRole)) {
    return res.status(400).json({ message: 'Некоректна роль автора звіту.' });
  }

  if (!reportText) {
    return res.status(400).json({ message: 'Вкажіть текст звіту.' });
  }

  if (reporterRole === 'helper' && !Number.isInteger(responseId)) {
    return res.status(400).json({ message: 'Для цього звіту потрібен відгук волонтера.' });
  }

  const client = await pool.connect();

  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ message: 'Потрібно увійти в систему.' });
    }

    await client.query('BEGIN');
    await ensureResponseStatusColumn(client);

    const postResult = await client.query(
      `
        SELECT post_id, user_rnokpp, post_status
        FROM post
        WHERE post_id = $1
      `,
      [postId]
    );

    const post = postResult.rows[0];
    if (!post) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Запит не знайдено.' });
    }

    if (reporterRole === 'author') {
      if (post.user_rnokpp !== currentUser.user_rnokpp) {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Ви не можете закрити чужий запит.' });
      }
    } else {
      const responseResult = await client.query(
        `
          SELECT response_id, user_rnokpp
          FROM response
          WHERE response_id = $1 AND post_id = $2
        `,
        [responseId, postId]
      );

      const response = responseResult.rows[0];
      if (!response) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Відгук не знайдено.' });
      }

      if (response.user_rnokpp !== currentUser.user_rnokpp) {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Ви не можете закрити чужий відгук.' });
      }
    }

    const reportNumber = await getNextId(client, 'report', 'report_number');
    const createdAt = new Date();

    await client.query(
      `
        INSERT INTO report (
          report_number,
          user_rnokpp,
          post_id,
          report_type,
          report_text,
          creation_datetime
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        reportNumber,
        currentUser.user_rnokpp,
        postId,
        reporterRole,
        reportText,
        createdAt,
      ]
    );

    for (const imageUrl of images) {
      const reportImageId = await getNextId(client, 'report_image', 'report_image_id');
      await client.query(
        `
          INSERT INTO report_image (report_image_id, report_number, report_image_url)
          VALUES ($1, $2, $3)
        `,
        [reportImageId, reportNumber, imageUrl]
      );
    }

    if (reporterRole === 'author') {
      await client.query(
        `
          UPDATE post
          SET post_status = 'closed'
          WHERE post_id = $1
        `,
        [postId]
      );
    } else {
      await client.query(
        `
          UPDATE response
          SET response_status = 'closed'
          WHERE response_id = $1
        `,
        [responseId]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Звіт збережено.',
      report: {
        reportId: String(reportNumber),
        requestId: String(postId),
        responseId: responseId ? String(responseId) : '',
        reporterRole,
        reporterUserRole: currentUser.role_name || '',
        reportTitle: REPORT_TITLES[reporterRole],
        text: reportText,
        images,
        createdAt: createdAt.getTime(),
        createdAtIso: createdAt.toISOString(),
        requestSnapshot: req.body.request_snapshot || {},
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Помилка створення звіту:', error);
    return res.status(500).json({ message: 'Не вдалося зберегти звіт.' });
  } finally {
    client.release();
  }
}

module.exports = {
  createReport,
  fetchAdminReports,
  fetchMyReports,
};
