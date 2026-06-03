const pool = require('../db');
const { readSessionPayload } = require('../session');
const { isAdmin } = require('../utils/admin');
const { normalizeImageList } = require('../utils/imageValidation');
const MAX_POST_IMAGE_COUNT = 5;
const POST_ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/webp',
  'image/bmp',
]);

const POST_TYPE_CONFIG = {
  fundraising: { id: 1, code: 'fundraising', name: 'Збір коштів' },
  request: { id: 2, code: 'request', name: 'Запит на допомогу' },
};

const POST_TYPE_BY_ID = Object.fromEntries(
  Object.values(POST_TYPE_CONFIG).map((type) => [type.id, type])
);

function normalizeScalarId(value) {
  return String(value ?? '').trim();
}

function normalizeNumericId(value) {
  const normalized = Number(normalizeScalarId(value));
  return Number.isFinite(normalized) ? normalized : null;
}

function getDefaultAvatar(roleCode) {
  return roleCode === 'mi'
    ? '/public/images/account-icon.png'
    : '/public/images/premium_photo-1689568126014-06fea9d5d341.jpg';
}

function getRoleCode(user) {
  return normalizeNumericId(user?.role_id) === 2 ? 'mi' : 'vo';
}

function formatPost(row) {
  const postTypeId = normalizeNumericId(row.post_type_id);
  const roleId = normalizeNumericId(row.role_id);
  const type = POST_TYPE_BY_ID[postTypeId] || {
    id: normalizeScalarId(row.post_type_id),
    code: 'fundraising',
    name: row.post_type_name || 'Допис',
  };

  const roleCode = roleId === 2 ? 'mi' : 'vo';

  return {
    postId: normalizeScalarId(row.post_id),
    authorId: row.user_rnokpp,
    authorName: row.user_name || 'Користувач',
    authorRole: row.role_name || (roleCode === 'mi' ? 'Військовий' : 'Волонтер'),
    authorRoleCode: roleCode,
    avatar: row.user_image_url || getDefaultAvatar(roleCode),
    type: type.code,
    typeName: type.name,
    title: row.post_title || '',
    description: row.post_description || '',
    status: row.post_status || (type.code === 'request' ? 'open' : 'active'),
    createdAt: row.post_datetime ? new Date(row.post_datetime).getTime() : Date.now(),
    createdAtIso: row.post_datetime ? new Date(row.post_datetime).toISOString() : new Date().toISOString(),
    tags: row.tags || [],
    images: row.images || [],
    responseCount: Number(row.response_count || 0),
    reportCount: Number(row.report_count || 0),
    hasLinkedActivity: Number(row.response_count || 0) > 0 || Number(row.report_count || 0) > 0,
    isOwnPost: false,
  };
}

async function ensurePostTypesExist(client = pool) {
  await client.query(
    `
      INSERT INTO post_type (post_type_id, post_type_name)
      VALUES ($1, $2), ($3, $4)
      ON CONFLICT (post_type_id) DO UPDATE
      SET post_type_name = EXCLUDED.post_type_name
    `,
    [
      POST_TYPE_CONFIG.fundraising.id,
      POST_TYPE_CONFIG.fundraising.name,
      POST_TYPE_CONFIG.request.id,
      POST_TYPE_CONFIG.request.name,
    ]
  );
}

function resolvePostType(type) {
  if (typeof type !== 'string') {
    return null;
  }

  return POST_TYPE_CONFIG[type.trim().toLowerCase()] || null;
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  const seen = new Set();
  return tags
    .map((tag) => String(tag || '').trim())
    .filter(Boolean)
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function normalizeImages(images) {
  return normalizeImageList(images, POST_ALLOWED_IMAGE_TYPES);
}

function validateOriginalImageList(rawImages, normalizedImages) {
  if (!Array.isArray(rawImages)) {
    return null;
  }

  const providedImages = rawImages
    .map((image) => String(image || '').trim())
    .filter(Boolean);

  if (providedImages.length !== normalizedImages.length) {
    return 'Можна додавати лише фото у форматі JPG, JPEG, PNG, WEBP або BMP. Гіфки для дописів не підтримуються.';
  }

  return null;
}

function validatePostPayload({ type, title, description }) {
  const postType = resolvePostType(type);
  if (!postType) {
    return 'Оберіть коректний тип допису.';
  }

  if (!title?.trim()) {
    return 'Вкажіть заголовок допису.';
  }

  if (!description?.trim()) {
    return 'Вкажіть текст допису.';
  }

  return null;
}

function validatePostImages(images) {
  if (images.length > MAX_POST_IMAGE_COUNT) {
    return `\u0414\u043e \u043e\u0434\u043d\u043e\u0433\u043e \u0434\u043e\u043f\u0438\u0441\u0443 \u043c\u043e\u0436\u043d\u0430 \u0434\u043e\u0434\u0430\u0442\u0438 \u043d\u0435 \u0431\u0456\u043b\u044c\u0448\u0435 ${MAX_POST_IMAGE_COUNT} \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u044c.`;
  }

  return null;
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

async function getOrCreateTagId(client, tagName) {
  const existing = await client.query(
    `
      SELECT tag_id
      FROM tag
      WHERE LOWER(tag_name) = LOWER($1)
      LIMIT 1
    `,
    [tagName]
  );

  if (existing.rows[0]) {
    return existing.rows[0].tag_id;
  }

  const tagId = await getNextId(client, 'tag', 'tag_id');
  await client.query(
    `
      INSERT INTO tag (tag_id, tag_name)
      VALUES ($1, $2)
    `,
    [tagId, tagName]
  );

  return tagId;
}

async function fetchPosts(req, res) {
  const type = req.query.type ? resolvePostType(req.query.type) : null;

  try {
    const currentUser = await getCurrentUser(req);
    await ensurePostTypesExist();

    const params = [];
    const filters = [];

    if (type) {
      params.push(type.id);
      filters.push(`p.post_type_id = $${params.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const result = await pool.query(
      `
        SELECT
          p.post_id,
          p.user_rnokpp,
          p.post_type_id,
          pt.post_type_name,
          p.post_title,
          p.post_description,
          p.post_status,
          p.post_datetime,
          u.user_name,
          u.user_image_url,
          u.role_id,
          r.role_name,
          COUNT(DISTINCT resp.response_id)::int AS response_count,
          COUNT(DISTINCT rep.report_number)::int AS report_count,
          COALESCE(array_remove(array_agg(DISTINCT t.tag_name), NULL), '{}') AS tags,
          COALESCE(array_remove(array_agg(DISTINCT pi.post_image_url), NULL), '{}') AS images
        FROM post p
        LEFT JOIN post_type pt ON pt.post_type_id = p.post_type_id
        LEFT JOIN app_user u ON u.user_rnokpp = p.user_rnokpp
        LEFT JOIN role r ON r.role_id = u.role_id
        LEFT JOIN post_tag ptg ON ptg.post_id = p.post_id
        LEFT JOIN tag t ON t.tag_id = ptg.tag_id
        LEFT JOIN post_image pi ON pi.post_id = p.post_id
        LEFT JOIN response resp ON resp.post_id = p.post_id
        LEFT JOIN report rep ON rep.post_id = p.post_id
        ${whereClause}
        GROUP BY
          p.post_id,
          p.user_rnokpp,
          p.post_type_id,
          pt.post_type_name,
          p.post_title,
          p.post_description,
          p.post_status,
          p.post_datetime,
          u.user_name,
          u.user_image_url,
          u.role_id,
          r.role_name
        ORDER BY p.post_datetime DESC NULLS LAST, p.post_id DESC
      `,
      params
    );

    const posts = result.rows.map((row) => {
      const post = formatPost(row);
      post.isOwnPost = currentUser ? post.authorId === currentUser.user_rnokpp : false;
      return post;
    });

    return res.status(200).json({ posts });
  } catch (error) {
    console.error('Помилка завантаження дописів:', error);
    return res.status(500).json({ message: 'Не вдалося завантажити дописи.' });
  }
}

async function createPost(req, res) {
  const validationError = validatePostPayload(req.body);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const { type, title, description } = req.body;
  const tags = normalizeTags(req.body.tags);
  const images = normalizeImages(req.body.images);
  const invalidImageMessage = validateOriginalImageList(req.body.images, images);
  if (invalidImageMessage) {
    return res.status(400).json({ message: invalidImageMessage });
  }
  const imageValidationError = validatePostImages(images);
  if (imageValidationError) {
    return res.status(400).json({ message: imageValidationError });
  }
  const postType = resolvePostType(type);
  const client = await pool.connect();

  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ message: 'Потрібно увійти в систему.' });
    }

    if (postType.code === 'request' && getRoleCode(currentUser) !== 'mi') {
      return res.status(403).json({ message: 'Створювати запити на допомогу можуть лише військові.' });
    }

    await client.query('BEGIN');
    await ensurePostTypesExist(client);

    const postId = await getNextId(client, 'post', 'post_id');
    const createdAt = new Date();
    const postStatus = postType.code === 'request' ? 'open' : 'active';

    await client.query(
      `
        INSERT INTO post (
          post_id,
          user_rnokpp,
          post_type_id,
          post_title,
          post_description,
          post_status,
          post_datetime
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        postId,
        currentUser.user_rnokpp,
        postType.id,
        title.trim(),
        description.trim(),
        postStatus,
        createdAt,
      ]
    );

    for (const imageUrl of images) {
      const postImageId = await getNextId(client, 'post_image', 'post_image_id');
      await client.query(
        `
          INSERT INTO post_image (post_image_id, post_id, post_image_url)
          VALUES ($1, $2, $3)
        `,
        [postImageId, postId, imageUrl]
      );
    }

    for (const tagName of tags) {
      const tagId = await getOrCreateTagId(client, tagName);
      await client.query(
        `
          INSERT INTO post_tag (tag_id, post_id)
          VALUES ($1, $2)
        `,
        [tagId, postId]
      );
    }

    await client.query('COMMIT');

    const post = {
      postId: String(postId),
      authorId: currentUser.user_rnokpp,
      authorName: currentUser.user_name || 'Користувач',
      authorRole: currentUser.role_name || 'Користувач',
      authorRoleCode: currentUser.role_id === 2 ? 'mi' : 'vo',
      avatar: currentUser.user_image_url || getDefaultAvatar(currentUser.role_id === 2 ? 'mi' : 'vo'),
      type: postType.code,
      typeName: postType.name,
      title: title.trim(),
      description: description.trim(),
      status: postStatus,
      createdAt: createdAt.getTime(),
      createdAtIso: createdAt.toISOString(),
      tags,
      images,
      isOwnPost: true,
    };

    return res.status(201).json({
      message: 'Допис успішно створено.',
      post,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Помилка створення допису:', error);
    return res.status(500).json({ message: 'Не вдалося створити допис.' });
  } finally {
    client.release();
  }
}

async function updatePost(req, res) {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId)) {
    return res.status(400).json({ message: 'Некоректний ідентифікатор допису.' });
  }

  const validationError = validatePostPayload(req.body);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const { type, title, description } = req.body;
  const tags = normalizeTags(req.body.tags);
  const images = normalizeImages(req.body.images);
  const invalidImageMessage = validateOriginalImageList(req.body.images, images);
  if (invalidImageMessage) {
    return res.status(400).json({ message: invalidImageMessage });
  }
  const imageValidationError = validatePostImages(images);
  if (imageValidationError) {
    return res.status(400).json({ message: imageValidationError });
  }
  const postType = resolvePostType(type);
  const client = await pool.connect();

  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ message: 'Потрібно увійти в систему.' });
    }

    if (postType.code === 'request' && getRoleCode(currentUser) !== 'mi') {
      return res.status(403).json({ message: 'Створювати запити на допомогу можуть лише військові.' });
    }

    await client.query('BEGIN');
    await ensurePostTypesExist(client);

    const existingResult = await client.query(
      `
        SELECT post_id, user_rnokpp, post_type_id, post_status
        FROM post
        WHERE post_id = $1
      `,
      [postId]
    );

    const existingPost = existingResult.rows[0];
    if (!existingPost) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Допис не знайдено.' });
    }

    if (existingPost.user_rnokpp !== currentUser.user_rnokpp) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Ви не можете редагувати чужий допис.' });
    }

    if (existingPost.post_status === 'closed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Закритий запит не можна редагувати.' });
    }

    if (normalizeNumericId(existingPost.post_type_id) !== postType.id) {
      const responseCountResult = await client.query(
        `
          SELECT COUNT(*)::int AS total
          FROM response
          WHERE post_id = $1
        `,
        [postId]
      );

      if (Number(responseCountResult.rows[0]?.total || 0) > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Не можна змінити тип допису після появи відгуків.' });
      }
    }

    await client.query(
      `
        UPDATE post
        SET
          post_type_id = $2,
          post_title = $3,
          post_description = $4
        WHERE post_id = $1
      `,
      [postId, postType.id, title.trim(), description.trim()]
    );

    await client.query('DELETE FROM post_tag WHERE post_id = $1', [postId]);
    await client.query('DELETE FROM post_image WHERE post_id = $1', [postId]);

    for (const imageUrl of images) {
      const postImageId = await getNextId(client, 'post_image', 'post_image_id');
      await client.query(
        `
          INSERT INTO post_image (post_image_id, post_id, post_image_url)
          VALUES ($1, $2, $3)
        `,
        [postImageId, postId, imageUrl]
      );
    }

    for (const tagName of tags) {
      const tagId = await getOrCreateTagId(client, tagName);
      await client.query(
        `
          INSERT INTO post_tag (tag_id, post_id)
          VALUES ($1, $2)
        `,
        [tagId, postId]
      );
    }

    await client.query('COMMIT');

    const updatedResult = await pool.query(
      `
        SELECT
          p.post_id,
          p.user_rnokpp,
          p.post_type_id,
          pt.post_type_name,
          p.post_title,
          p.post_description,
          p.post_status,
          p.post_datetime,
          u.user_name,
          u.user_image_url,
          u.role_id,
          r.role_name,
          COUNT(DISTINCT resp.response_id)::int AS response_count,
          COUNT(DISTINCT rep.report_number)::int AS report_count,
          COALESCE(array_remove(array_agg(DISTINCT t.tag_name), NULL), '{}') AS tags,
          COALESCE(array_remove(array_agg(DISTINCT pi.post_image_url), NULL), '{}') AS images
        FROM post p
        LEFT JOIN post_type pt ON pt.post_type_id = p.post_type_id
        LEFT JOIN app_user u ON u.user_rnokpp = p.user_rnokpp
        LEFT JOIN role r ON r.role_id = u.role_id
        LEFT JOIN post_tag ptg ON ptg.post_id = p.post_id
        LEFT JOIN tag t ON t.tag_id = ptg.tag_id
        LEFT JOIN post_image pi ON pi.post_id = p.post_id
        LEFT JOIN response resp ON resp.post_id = p.post_id
        LEFT JOIN report rep ON rep.post_id = p.post_id
        WHERE p.post_id = $1
        GROUP BY
          p.post_id,
          p.user_rnokpp,
          p.post_type_id,
          pt.post_type_name,
          p.post_title,
          p.post_description,
          p.post_status,
          p.post_datetime,
          u.user_name,
          u.user_image_url,
          u.role_id,
          r.role_name
      `,
      [postId]
    );

    const post = formatPost(updatedResult.rows[0]);
    post.isOwnPost = true;

    return res.status(200).json({
      message: 'Допис оновлено.',
      post,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Помилка оновлення допису:', error);
    return res.status(500).json({ message: 'Не вдалося оновити допис.' });
  } finally {
    client.release();
  }
}

async function deletePost(req, res) {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId)) {
    return res.status(400).json({ message: 'Некоректний ідентифікатор допису.' });
  }

  const client = await pool.connect();

  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ message: 'Потрібно увійти в систему.' });
    }

    await client.query('BEGIN');

    const existing = await client.query(
      `
        SELECT post_id, user_rnokpp
        FROM post
        WHERE post_id = $1
      `,
      [postId]
    );

    const post = existing.rows[0];
    if (!post) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Допис не знайдено.' });
    }

    if (post.user_rnokpp !== currentUser.user_rnokpp && !isAdmin(currentUser)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Ви не можете видалити чужий допис.' });
    }

    const linkedActivityResult = await client.query(
      `
        SELECT
          (SELECT COUNT(*)::int FROM response WHERE post_id = $1) AS response_count,
          (SELECT COUNT(*)::int FROM report WHERE post_id = $1) AS report_count
      `,
      [postId]
    );

    const responseCount = Number(linkedActivityResult.rows[0]?.response_count || 0);
    const reportCount = Number(linkedActivityResult.rows[0]?.report_count || 0);
    if (responseCount > 0 || reportCount > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'Не можна видалити допис, якщо з ним уже пов’язані відгуки або звіти.',
      });
    }

    await client.query('DELETE FROM post_tag WHERE post_id = $1', [postId]);
    await client.query('DELETE FROM post_image WHERE post_id = $1', [postId]);
    await client.query('DELETE FROM post WHERE post_id = $1', [postId]);

    await client.query('COMMIT');
    return res.status(200).json({ message: 'Допис видалено.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Помилка видалення допису:', error);
    return res.status(500).json({ message: 'Не вдалося видалити допис.' });
  } finally {
    client.release();
  }
}

module.exports = {
  createPost,
  deletePost,
  fetchPosts,
  updatePost,
};
