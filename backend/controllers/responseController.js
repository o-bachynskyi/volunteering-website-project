const pool = require('../db');
const { readSessionPayload } = require('../session');
const { sendResponseNotification } = require('../services/mailer');

function getDefaultAvatar(roleCode) {
  return roleCode === 'mi'
    ? '/public/images/account-icon.png'
    : '/public/images/premium_photo-1689568126014-06fea9d5d341.jpg';
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

function normalizeImages(images) {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .map((image) => String(image || '').trim())
    .filter(Boolean);
}

function formatAcceptedRequest(row, currentUser) {
  const roleCode = row.author_role_id === 2 ? 'mi' : 'vo';

  return {
    responseId: String(row.response_id),
    requestId: String(row.post_id),
    responderId: row.user_rnokpp,
    title: row.post_title || '',
    description: row.post_description || '',
    tags: row.tags || [],
    authorName: row.author_name || 'Користувач',
    authorRole: row.author_role_name || (roleCode === 'mi' ? 'Військовий' : 'Волонтер'),
    avatar: row.author_image_url || getDefaultAvatar(roleCode),
    images: row.post_images || [],
    responseTitle: row.response_title || '',
    responseDescription: row.response_description || '',
    responseImages: row.response_images || [],
    createdAt: row.response_datetime ? new Date(row.response_datetime).getTime() : Date.now(),
    createdAtIso: row.response_datetime ? new Date(row.response_datetime).toISOString() : new Date().toISOString(),
    acceptedAt: row.response_datetime ? new Date(row.response_datetime).getTime() : Date.now(),
    acceptedDateText: row.response_datetime ? new Date(row.response_datetime).toISOString() : new Date().toISOString(),
    status: row.post_status === 'closed' ? 'closed' : (row.response_status || 'open'),
    isOwnResponse: currentUser ? currentUser.user_rnokpp === row.user_rnokpp : false,
  };
}

async function fetchAcceptedRequests(req, res) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ message: 'Потрібно увійти в систему.' });
    }

    await ensureResponseStatusColumn();

    const result = await pool.query(
      `
        SELECT
          rsp.response_id,
          rsp.user_rnokpp,
          rsp.post_id,
          rsp.response_status,
          rsp.response_title,
          rsp.response_description,
          rsp.response_datetime,
          p.post_title,
          p.post_description,
          p.post_status,
          author.user_name AS author_name,
          author.user_image_url AS author_image_url,
          author.role_id AS author_role_id,
          author_role.role_name AS author_role_name,
          COALESCE(array_remove(array_agg(DISTINCT t.tag_name), NULL), '{}') AS tags,
          COALESCE(array_remove(array_agg(DISTINCT pi.post_image_url), NULL), '{}') AS post_images,
          COALESCE(array_remove(array_agg(DISTINCT ri.response_image_url), NULL), '{}') AS response_images
        FROM response rsp
        INNER JOIN post p ON p.post_id = rsp.post_id
        LEFT JOIN app_user author ON author.user_rnokpp = p.user_rnokpp
        LEFT JOIN role author_role ON author_role.role_id = author.role_id
        LEFT JOIN post_tag ptg ON ptg.post_id = p.post_id
        LEFT JOIN tag t ON t.tag_id = ptg.tag_id
        LEFT JOIN post_image pi ON pi.post_id = p.post_id
        LEFT JOIN response_image ri ON ri.response_id = rsp.response_id
        WHERE rsp.user_rnokpp = $1
        GROUP BY
          rsp.response_id,
          rsp.user_rnokpp,
          rsp.post_id,
          rsp.response_status,
          rsp.response_title,
          rsp.response_description,
          rsp.response_datetime,
          p.post_title,
          p.post_description,
          p.post_status,
          author.user_name,
          author.user_image_url,
          author.role_id,
          author_role.role_name
        ORDER BY rsp.response_datetime DESC NULLS LAST, rsp.response_id DESC
      `,
      [currentUser.user_rnokpp]
    );

    const acceptedRequests = result.rows.map((row) => formatAcceptedRequest(row, currentUser));
    return res.status(200).json({ acceptedRequests });
  } catch (error) {
    console.error('Помилка завантаження прийнятих запитів:', error);
    return res.status(500).json({ message: 'Не вдалося завантажити прийняті запити.' });
  }
}

async function createResponse(req, res) {
  const postId = Number(req.body.post_id);
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  const images = normalizeImages(req.body.images);

  if (!Number.isInteger(postId)) {
    return res.status(400).json({ message: 'Некоректний запит.' });
  }

  if (!title) {
    return res.status(400).json({ message: 'Вкажіть заголовок відповіді.' });
  }

  if (!description) {
    return res.status(400).json({ message: 'Вкажіть текст відповіді.' });
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
        SELECT
          p.post_id,
          p.user_rnokpp,
          p.post_type_id,
          p.post_status,
          p.post_title,
          owner.user_name AS owner_name,
          owner.user_email AS owner_email
        FROM post p
        LEFT JOIN app_user owner ON owner.user_rnokpp = p.user_rnokpp
        WHERE p.post_id = $1
      `,
      [postId]
    );

    const post = postResult.rows[0];
    if (!post) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Запит не знайдено.' });
    }

    if (post.user_rnokpp === currentUser.user_rnokpp) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Ви не можете відгукнутися на власний запит.' });
    }

    if (post.post_type_id !== 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Відгук доступний лише для запитів на допомогу.' });
    }

    if (post.post_status === 'closed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Цей запит уже закрито.' });
    }

    const existingResponse = await client.query(
      `
        SELECT response_id
        FROM response
        WHERE user_rnokpp = $1 AND post_id = $2
        LIMIT 1
      `,
      [currentUser.user_rnokpp, postId]
    );

    if (existingResponse.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Ви вже відгукнулися на цей запит.' });
    }

    const responseId = await getNextId(client, 'response', 'response_id');
    const createdAt = new Date();

    await client.query(
      `
        INSERT INTO response (
          response_id,
          user_rnokpp,
          post_id,
          response_status,
          response_title,
          response_description,
          response_datetime
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        responseId,
        currentUser.user_rnokpp,
        postId,
        'open',
        title,
        description,
        createdAt,
      ]
    );

    for (const imageUrl of images) {
      const responseImageId = await getNextId(client, 'response_image', 'response_image_id');
      await client.query(
        `
          INSERT INTO response_image (response_image_id, response_id, response_image_url)
          VALUES ($1, $2, $3)
        `,
        [responseImageId, responseId, imageUrl]
      );
    }

    await client.query('COMMIT');

    try {
      await sendResponseNotification({
        postOwnerEmail: post.owner_email,
        postOwnerName: post.owner_name,
        responderName: currentUser.user_name,
        postTitle: post.post_title,
        responseTitle: title,
        responseDescription: description,
      });
    } catch (mailError) {
      console.error('Не вдалося надіслати email-сповіщення про відгук:', mailError);
    }

    return res.status(201).json({
      message: 'Відгук успішно надіслано.',
      response: {
        responseId: String(responseId),
        postId: String(postId),
        title,
        description,
        images,
        createdAt: createdAt.getTime(),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Помилка створення відгуку:', error);
    return res.status(500).json({ message: 'Не вдалося надіслати відгук.' });
  } finally {
    client.release();
  }
}

async function deleteResponse(req, res) {
  const responseId = Number(req.params.responseId);
  if (!Number.isInteger(responseId)) {
    return res.status(400).json({ message: 'Некоректний ідентифікатор відгуку.' });
  }

  const client = await pool.connect();

  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ message: 'Потрібно увійти в систему.' });
    }

    await client.query('BEGIN');

    const result = await client.query(
      `
        SELECT response_id, user_rnokpp
        FROM response
        WHERE response_id = $1
      `,
      [responseId]
    );

    const responseRow = result.rows[0];
    if (!responseRow) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Відгук не знайдено.' });
    }

    if (responseRow.user_rnokpp !== currentUser.user_rnokpp) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Ви не можете видалити чужий відгук.' });
    }

    await client.query('DELETE FROM response_image WHERE response_id = $1', [responseId]);
    await client.query('DELETE FROM response WHERE response_id = $1', [responseId]);

    await client.query('COMMIT');
    return res.status(200).json({ message: 'Відгук видалено.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Помилка видалення відгуку:', error);
    return res.status(500).json({ message: 'Не вдалося видалити відгук.' });
  } finally {
    client.release();
  }
}

module.exports = {
  createResponse,
  deleteResponse,
  fetchAcceptedRequests,
};
