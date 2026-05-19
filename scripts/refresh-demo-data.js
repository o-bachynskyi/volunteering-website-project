const bcrypt = require('bcrypt');
const { Client } = require('pg');

const DEMO_PROFILE_DESCRIPTION =
  'Мене звати Олег, я займаюсь волонтерською діяльністю з перших днів повномасштабного вторгнення. Координую логістику доставки гуманітарної допомоги до прифронтових районів, організовую збори коштів та товарів для військових і цивільних. Працюю у команді з іншими волонтерами по всій Україні.';

const demoUsers = [
  {
    rnokpp: '1000000001',
    roleId: 1,
    name: 'Олег',
    email: 'oleg.demo@example.com',
    imageUrl: '/public/images/premium_photo-1689568126014-06fea9d5d341.jpg',
    description: DEMO_PROFILE_DESCRIPTION,
    tags: ['Допомога ЗСУ', 'Гуманітарна допомога', 'Збір коштів', 'Логістика', 'Амуніція'],
  },
  {
    rnokpp: '2000000001',
    roleId: 2,
    name: 'Сергій',
    email: 'serhii.demo@example.com',
    imageUrl: '/public/images/account-icon.png',
    description: 'Військовослужбовець, який координує потреби підрозділу на позиціях і публікує актуальні запити на допомогу.',
    tags: ['Генератор', 'Електроживлення', 'Зв’язок'],
  },
  {
    rnokpp: '2000000002',
    roleId: 2,
    name: 'Іван',
    email: 'ivan.demo@example.com',
    imageUrl: '/public/images/account-icon.png',
    description: 'Військовий медик, який веде збір критично важливого спорядження для мобільних груп.',
    tags: ['Медицина', 'IFAK', 'Турнікети'],
  },
];

const demoPosts = [
  {
    author: '1000000001',
    typeId: 1,
    title: 'Терміновий збір для гуманітарної допомоги.',
    description:
      'Ми збираємо кошти на продукти, засоби гігієни та медикаменти для мешканців прифронтових сіл. Кожна ваша гривня — це реальна допомога. Долучайтеся!',
    status: 'active',
    imageUrls: ['/public/images/premium_photo-1689568126014-06fea9d5d341.jpg'],
    tags: ['Гуманітарна допомога', 'Логістика', 'Збір коштів', 'Медикаменти'],
    daysAgo: 2,
  },
  {
    author: '2000000001',
    typeId: 2,
    title: 'Потрібна допомога з генератором для бліндажа.',
    description:
      'Наш підрозділ наразі виконує завдання в зоні активних бойових дій. Через часті перебої з електрикою терміново потрібен генератор (від 2.5 кВт) для забезпечення зв’язку та зарядки обладнання. Будемо вдячні за будь-яку допомогу або координати перевірених постачальників.',
    status: 'open',
    imageUrls: ['/public/images/generator.png'],
    tags: ['Генератор', 'Електроживлення', 'Зв’язок', 'Терміново'],
    daysAgo: 1,
  },
  {
    author: '2000000002',
    typeId: 2,
    title: 'Запит на аптечки та тактичні рюкзаки',
    description:
      'Шукаємо допомогу з комплектуванням індивідуальних аптечок IFAK, турнікетів та базових засобів медичної допомоги. Також актуальні тактичні рюкзаки для мобільних груп. Дякуємо всім небайдужим, ваша підтримка рятує життя.',
    status: 'open',
    imageUrls: [],
    tags: ['Медицина', 'IFAK', 'Турнікети', 'Тактичні рюкзаки'],
    daysAgo: 2,
  },
];

async function getNextId(client, table, column) {
  const result = await client.query(`SELECT COALESCE(MAX(${column}), 0) + 1 AS next_id FROM ${table}`);
  return Number(result.rows[0].next_id);
}

async function getOrCreateTagId(client, tagName) {
  const existing = await client.query(
    'SELECT tag_id FROM tag WHERE LOWER(tag_name) = LOWER($1) LIMIT 1',
    [tagName]
  );

  if (existing.rows[0]) {
    return Number(existing.rows[0].tag_id);
  }

  const tagId = await getNextId(client, 'tag', 'tag_id');
  await client.query('INSERT INTO tag (tag_id, tag_name) VALUES ($1, $2)', [tagId, tagName]);
  return tagId;
}

async function removePreviousDemoData(client) {
  const removableUsers = await client.query(`
    SELECT user_rnokpp
    FROM app_user
    WHERE user_email LIKE '%@example.com'
      AND (
        user_email LIKE 'demo.%'
        OR user_email LIKE 'mil%@example.com'
        OR user_email LIKE 'vol%@example.com'
        OR user_email LIKE '%.demo@example.com'
        OR user_email = 'test221938@example.com'
      )
  `);

  const removableIds = removableUsers.rows.map((row) => row.user_rnokpp);
  if (!removableIds.length) {
    return;
  }

  const postsToRemove = await client.query('SELECT post_id FROM post WHERE user_rnokpp = ANY($1)', [removableIds]);
  const postIds = postsToRemove.rows.map((row) => Number(row.post_id));

  if (postIds.length) {
    const responsesToRemove = await client.query('SELECT response_id FROM response WHERE post_id = ANY($1)', [postIds]);
    const responseIds = responsesToRemove.rows.map((row) => Number(row.response_id));

    await client.query(
      'DELETE FROM report_image WHERE report_number IN (SELECT report_number FROM report WHERE post_id = ANY($1))',
      [postIds]
    );
    await client.query('DELETE FROM report WHERE post_id = ANY($1)', [postIds]);

    if (responseIds.length) {
      await client.query('DELETE FROM response_image WHERE response_id = ANY($1)', [responseIds]);
    }

    await client.query('DELETE FROM response WHERE post_id = ANY($1)', [postIds]);
    await client.query('DELETE FROM post_image WHERE post_id = ANY($1)', [postIds]);
    await client.query('DELETE FROM post_tag WHERE post_id = ANY($1)', [postIds]);
    await client.query('DELETE FROM post WHERE post_id = ANY($1)', [postIds]);
  }

  await client.query('DELETE FROM user_tag WHERE user_rnokpp = ANY($1)', [removableIds]);
  await client.query('DELETE FROM app_user WHERE user_rnokpp = ANY($1)', [removableIds]);
}

async function insertDemoData(client) {
  const passwordHash = await bcrypt.hash('password123', 10);

  for (const user of demoUsers) {
    await client.query(
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
      `,
      [user.rnokpp, user.roleId, user.name, user.email, passwordHash, user.description, user.imageUrl]
    );

    for (const tagName of user.tags) {
      const tagId = await getOrCreateTagId(client, tagName);
      await client.query('INSERT INTO user_tag (user_rnokpp, tag_id) VALUES ($1, $2)', [user.rnokpp, tagId]);
    }
  }

  for (const post of demoPosts) {
    const postId = await getNextId(client, 'post', 'post_id');
    const createdAt = new Date(Date.now() - post.daysAgo * 24 * 60 * 60 * 1000);

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
      [postId, post.author, post.typeId, post.title, post.description, post.status, createdAt]
    );

    for (const imageUrl of post.imageUrls) {
      const imageId = await getNextId(client, 'post_image', 'post_image_id');
      await client.query(
        'INSERT INTO post_image (post_image_id, post_id, post_image_url) VALUES ($1, $2, $3)',
        [imageId, postId, imageUrl]
      );
    }

    for (const tagName of post.tags) {
      const tagId = await getOrCreateTagId(client, tagName);
      await client.query('INSERT INTO post_tag (tag_id, post_id) VALUES ($1, $2)', [tagId, postId]);
    }
  }
}

async function main() {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'lab-5.v2',
    password: '542604',
    port: 5432,
  });

  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO role (role_id, role_name)
      VALUES (1, 'Волонтер'), (2, 'Військовий')
      ON CONFLICT (role_id) DO UPDATE
      SET role_name = EXCLUDED.role_name
    `);

    await removePreviousDemoData(client);
    await insertDemoData(client);
    await client.query('COMMIT');
    console.log('Demo data refreshed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
