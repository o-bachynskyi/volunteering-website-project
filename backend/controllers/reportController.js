const pool = require('../db');
const { readSessionPayload } = require('../session');

const REPORT_TITLES = {
  author: 'Звіт про отримання допомоги',
  helper: 'Звіт про надання допомоги',
};

function normalizeImages(images) {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .map((image) => String(image || '').trim())
    .filter(Boolean);
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
    `SELECT COALESCE(MAX(${idColumn}), 0) + 1 AS next_id FROM ${tableName}`
  );
  return Number(result.rows[0].next_id);
}

async function ensureResponseStatusColumn(client = pool) {
  await client.query(`
    ALTER TABLE response
    ADD COLUMN IF NOT EXISTS response_status TEXT DEFAULT 'open'
  `);
}

async function ensureReportsTables(client = pool) {
  await ensureResponseStatusColumn(client);
  await client.query(`
    CREATE TABLE IF NOT EXISTS report (
      report_id INTEGER PRIMARY KEY,
      user_rnokpp VARCHAR(32) NOT NULL,
      post_id INTEGER NOT NULL,
      response_id INTEGER NULL,
      reporter_role TEXT NOT NULL,
      report_title TEXT NOT NULL,
      report_text TEXT NOT NULL,
      report_datetime TIMESTAMP NOT NULL DEFAULT NOW(),
      request_snapshot TEXT NOT NULL DEFAULT '{}'
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS report_image (
      report_image_id INTEGER PRIMARY KEY,
      report_id INTEGER NOT NULL,
      report_image_url TEXT NOT NULL
    )
  `);
}

function formatReport(row) {
  let requestSnapshot = {};

  try {
    requestSnapshot = row.request_snapshot ? JSON.parse(row.request_snapshot) : {};
  } catch (error) {
    requestSnapshot = {};
  }

  return {
    reportId: String(row.report_id),
    requestId: String(row.post_id),
    responseId: row.response_id ? String(row.response_id) : '',
    reporterRole: row.reporter_role,
    reporterUserRole: row.role_name || (row.reporter_role === 'author' ? 'Військовий' : 'Волонтер'),
    reportTitle: row.report_title,
    text: row.report_text,
    images: row.images || [],
    createdAt: row.report_datetime ? new Date(row.report_datetime).getTime() : Date.now(),
    createdAtIso: row.report_datetime ? new Date(row.report_datetime).toISOString() : new Date().toISOString(),
    requestSnapshot,
  };
}

async function fetchMyReports(req, res) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ message: 'Потрібно увійти в систему.' });
    }

    await ensureReportsTables();

    const result = await pool.query(
      `
        SELECT
          rp.report_id,
          rp.post_id,
          rp.response_id,
          rp.reporter_role,
          rp.report_title,
          rp.report_text,
          rp.report_datetime,
          rp.request_snapshot,
          u.role_name,
          COALESCE(array_remove(array_agg(DISTINCT ri.report_image_url), NULL), '{}') AS images
        FROM report rp
        LEFT JOIN app_user au ON au.user_rnokpp = rp.user_rnokpp
        LEFT JOIN role u ON u.role_id = au.role_id
        LEFT JOIN report_image ri ON ri.report_id = rp.report_id
        WHERE rp.user_rnokpp = $1
        GROUP BY
          rp.report_id,
          rp.post_id,
          rp.response_id,
          rp.reporter_role,
          rp.report_title,
          rp.report_text,
          rp.report_datetime,
          rp.request_snapshot,
          u.role_name
        ORDER BY rp.report_datetime DESC, rp.report_id DESC
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

async function createReport(req, res) {
  const postId = Number(req.body.post_id);
  const responseId = req.body.response_id == null || req.body.response_id === ''
    ? null
    : Number(req.body.response_id);
  const reporterRole = String(req.body.reporter_role || '').trim().toLowerCase();
  const reportText = String(req.body.text || '').trim();
  const requestSnapshot = req.body.request_snapshot || {};
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
    await ensureReportsTables(client);

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
          SELECT response_id, user_rnokpp, response_status
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

    const reportId = await getNextId(client, 'report', 'report_id');
    const createdAt = new Date();

    await client.query(
      `
        INSERT INTO report (
          report_id,
          user_rnokpp,
          post_id,
          response_id,
          reporter_role,
          report_title,
          report_text,
          report_datetime,
          request_snapshot
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        reportId,
        currentUser.user_rnokpp,
        postId,
        responseId,
        reporterRole,
        REPORT_TITLES[reporterRole],
        reportText,
        createdAt,
        JSON.stringify(requestSnapshot || {}),
      ]
    );

    for (const imageUrl of images) {
      const reportImageId = await getNextId(client, 'report_image', 'report_image_id');
      await client.query(
        `
          INSERT INTO report_image (report_image_id, report_id, report_image_url)
          VALUES ($1, $2, $3)
        `,
        [reportImageId, reportId, imageUrl]
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
        reportId: String(reportId),
        requestId: String(postId),
        responseId: responseId ? String(responseId) : '',
        reporterRole,
        reporterUserRole: currentUser.role_name || '',
        reportTitle: REPORT_TITLES[reporterRole],
        text: reportText,
        images,
        createdAt: createdAt.getTime(),
        createdAtIso: createdAt.toISOString(),
        requestSnapshot,
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
  fetchMyReports,
};
