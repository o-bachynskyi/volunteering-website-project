const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DEMO_PASSWORD = 'demo12345';
const ADMIN_RNOKPP = String(process.env.ADMIN_RNOKPP || '1234567890').trim();

const DEMO_IMAGE_URLS = {
  fundraiserHumanitarian: '/public/images/demo/fundraiser-humanitarian.jpg',
  fundraiserRehab: '/public/images/demo/fundraiser-rehab.jpg',
  requestGenerator: '/public/images/demo/request-generator.jpg',
  requestMedicine: '/public/images/demo/request-medicine.jpg',
  requestDrone: '/public/images/demo/request-drone.jpg',
  requestVehicle: '/public/images/demo/request-vehicle.jpg',
  requestPowerbank: '/public/images/demo/request-powerbank.jpg',
  requestThermal: '/public/images/demo/request-thermal.jpg',
  responseDelivery: '/public/images/demo/response-delivery.jpg',
  responseEquipment: '/public/images/demo/response-equipment.jpg',
  responseMedicine: '/public/images/demo/response-medicine.jpg',
  reportResult: '/public/images/demo/report-result.jpg',
  reportHandover: '/public/images/demo/report-handover.jpg',
};

const antonTags = ['адміністрування', 'координація', 'волонтерство'];

const demoUsers = [
  {
    rnokpp: '2000000001',
    roleId: 2,
    name: 'Сергій Мельник',
    email: 'serhii.melnyk.demo@example.com',
    imageUrl: '/public/images/demo/profiles/serhii-melnyk.jpg',
    description:
      'Військовослужбовець підрозділу зв’язку. Публікує запити на обладнання для підтримки стабільного зв’язку, енергоживлення та навігації на позиціях.',
    tags: ['зв’язок', 'starlink', 'генератори', 'акумулятори'],
  },
  {
    rnokpp: '2000000002',
    roleId: 2,
    name: 'Ірина Бондар',
    email: 'iryna.bondar.demo@example.com',
    imageUrl: '/public/images/demo/profiles/iryna-bondar.jpg',
    description:
      'Військова медикиня. Координує потреби мобільної групи в аптечках, турнікетах, ношах та засобах першої допомоги.',
    tags: ['медицина', 'ifak', 'турнікети', 'евакуація'],
  },
  {
    rnokpp: '2000000003',
    roleId: 2,
    name: 'Андрій Сахно',
    email: 'andrii.sakhno.demo@example.com',
    imageUrl: '/public/images/demo/profiles/andrii-sakhno.jpg',
    description:
      'Командир екіпажу евакуаційного транспорту. Працює з потребами в паливі, зарядних пристроях, тепловізійних приладах та транспортному обладнанні.',
    tags: ['транспорт', 'тепловізор', 'павербанки', 'ремонт'],
  },
  {
    rnokpp: '1000000001',
    roleId: 1,
    name: 'Олена Коваль',
    email: 'olena.koval.demo@example.com',
    imageUrl: '/public/images/demo/profiles/olena-koval.jpg',
    description:
      'Волонтерка з логістики. Організовує збір і доставку гуманітарної допомоги, спорядження та медичних комплектів для підрозділів.',
    tags: ['логістика', 'гуманітарна допомога', 'доставка', 'медицина'],
  },
  {
    rnokpp: '1000000002',
    roleId: 1,
    name: 'Максим Дяченко',
    email: 'maksym.diachenko.demo@example.com',
    imageUrl: '/public/images/demo/profiles/maksym-diachenko.jpg',
    description:
      'Волонтер технічного напряму. Допомагає із закупівлею дронів, оптики, зарядних станцій та електроніки для фронту.',
    tags: ['дрони', 'оптика', 'зарядні станції', 'техніка'],
  },
  {
    rnokpp: '1000000003',
    roleId: 1,
    name: 'Наталія Гуменюк',
    email: 'nataliia.humeniuk.demo@example.com',
    imageUrl: '/public/images/demo/profiles/nataliia-humeniuk.jpg',
    description:
      'Волонтерка медичного напряму. Працює із забезпеченням аптечок, витратних матеріалів, реабілітаційного обладнання та адресних передач.',
    tags: ['медицина', 'реабілітація', 'аптечки', 'адресна допомога'],
  },
  {
    rnokpp: '1000000004',
    roleId: 1,
    name: 'Тарас Олійник',
    email: 'taras.oliinyk.demo@example.com',
    imageUrl: '/public/images/demo/profiles/taras-oliinyk.jpg',
    description:
      'Волонтер з техніки та транспорту. Допомагає з підбором автомобільних запчастин, живлення, інструментів і польового обладнання.',
    tags: ['транспорт', 'ремонт', 'інструменти', 'живлення'],
  },
];

const demoPosts = [
  {
    slug: 'anton-fundraiser',
    author: ADMIN_RNOKPP,
    typeId: 1,
    title: 'Збір на акумулятори та зарядні станції для евакуаційної групи',
    description:
      'Відкрито збір на акумулятори великої ємності та портативні зарядні станції для екіпажу, який виконує евакуаційні виїзди. Обладнання потрібне для безперебійної роботи радіостанцій, планшетів і медичного оснащення в польових умовах.',
    status: 'active',
    imageUrls: [DEMO_IMAGE_URLS.fundraiserHumanitarian],
    tags: ['збір коштів', 'акумулятори', 'зарядні станції', 'евакуація'],
    daysAgo: 1,
  },
  {
    slug: 'rehab-fundraiser',
    author: '1000000003',
    typeId: 1,
    title: 'Збір на реабілітаційні набори для поранених військових',
    description:
      'Проводимо збір на еластичні бинти, реабілітаційні стрічки, ортези та супутні витратні матеріали для поранених військових, які проходять відновлення після лікування.',
    status: 'active',
    imageUrls: [DEMO_IMAGE_URLS.fundraiserRehab],
    tags: ['реабілітація', 'медицина', 'збір коштів', 'поранені'],
    daysAgo: 4,
  },
  {
    slug: 'generator-request',
    author: '2000000001',
    typeId: 2,
    title: 'Потрібен генератор та Starlink для польового пункту зв’язку',
    description:
      'Підрозділ працює на позиціях зі складним енергозабезпеченням. Потрібен генератор від 3 кВт, а також комплект Starlink для резервного каналу зв’язку. Допомога потрібна терміново, оскільки поточне обладнання працює нестабільно.',
    status: 'open',
    imageUrls: [DEMO_IMAGE_URLS.requestGenerator],
    tags: ['генератори', 'starlink', 'зв’язок', 'терміново'],
    daysAgo: 2,
  },
  {
    slug: 'medical-request-closed',
    author: '2000000002',
    typeId: 2,
    title: 'Потрібні турнікети та аптечки IFAK для мобільної групи',
    description:
      'Для мобільної групи були потрібні сучасні турнікети, аптечки IFAK та витратні матеріали для надання першої допомоги. Запит уже виконано, тому його залишено в системі як приклад завершеної взаємодії між військовими та волонтерами.',
    status: 'closed',
    imageUrls: [DEMO_IMAGE_URLS.requestMedicine],
    tags: ['медицина', 'ifak', 'турнікети', 'завершено'],
    daysAgo: 6,
  },
  {
    slug: 'drone-request',
    author: '2000000001',
    typeId: 2,
    title: 'Потрібен квадрокоптер для аеророзвідки та коригування',
    description:
      'Шукаємо можливість оперативно передати квадрокоптер із базовим комплектом акумуляторів для виконання аеророзвідки та коригування роботи підрозділу. Розглядаємо як готовий апарат, так і допомогу із закупівлею.',
    status: 'open',
    imageUrls: [DEMO_IMAGE_URLS.requestDrone],
    tags: ['дрони', 'аеророзвідка', 'акумулятори', 'техніка'],
    daysAgo: 3,
  },
  {
    slug: 'vehicle-request',
    author: '2000000003',
    typeId: 2,
    title: 'Потрібні запчастини та інструменти для евакуаційного авто',
    description:
      'Після інтенсивних виїздів евакуаційне авто потребує ремонту. Потрібні базові запчастини, домкрат, набір інструментів та витратні матеріали для швидкого повернення машини до роботи.',
    status: 'open',
    imageUrls: [DEMO_IMAGE_URLS.requestVehicle],
    tags: ['транспорт', 'ремонт', 'інструменти', 'евакуація'],
    daysAgo: 5,
  },
  {
    slug: 'powerbank-request',
    author: '2000000003',
    typeId: 2,
    title: 'Потрібні павербанки та ліхтарі для чергової зміни',
    description:
      'Для чергової зміни потрібні місткі павербанки, налобні ліхтарі та кабелі живлення. Оснащення використовується під час нічних виїздів і чергувань.',
    status: 'open',
    imageUrls: [DEMO_IMAGE_URLS.requestPowerbank],
    tags: ['павербанки', 'ліхтарі', 'живлення', 'чергування'],
    daysAgo: 2,
  },
  {
    slug: 'thermal-request-closed',
    author: '2000000003',
    typeId: 2,
    title: 'Потрібен тепловізор для нічного спостереження',
    description:
      'Раніше підрозділ мав потребу в тепловізорі для нічного спостереження та безпечного пересування. Запит уже реалізований і залишений як демонстраційний приклад успішного закриття потреби.',
    status: 'closed',
    imageUrls: [DEMO_IMAGE_URLS.requestThermal],
    tags: ['тепловізор', 'нічне спостереження', 'техніка', 'завершено'],
    daysAgo: 8,
  },
];

const demoResponses = [
  {
    author: '1000000001',
    postSlug: 'generator-request',
    title: 'Можемо передати генератор через два дні',
    description:
      'Є можливість передати перевірений генератор на 3.2 кВт і допомогти з логістикою до точки видачі. Також уточнюємо наявність додаткового комплекту кабелів для підключення.',
    status: 'open',
    imageUrls: [DEMO_IMAGE_URLS.responseDelivery],
    daysAgo: 1,
  },
  {
    author: '1000000002',
    postSlug: 'generator-request',
    title: 'Підкажу постачальника Starlink і резервного живлення',
    description:
      'Маю контакт перевіреного постачальника Starlink і можу долучитися до збору на інвертор та батареї резервного живлення.',
    status: 'open',
    imageUrls: [],
    daysAgo: 1,
  },
  {
    author: '1000000001',
    postSlug: 'medical-request-closed',
    title: 'Аптечки та турнікети сформовано і передано',
    description:
      'Зібрано комплект аптечок IFAK, турнікетів і базових засобів першої допомоги. Передачу виконано через координатора підрозділу, отримання підтверджено.',
    status: 'closed',
    imageUrls: [DEMO_IMAGE_URLS.responseMedicine],
    daysAgo: 5,
  },
  {
    author: '1000000002',
    postSlug: 'drone-request',
    title: 'Можемо закрити частину потреби по дрону',
    description:
      'Готовий допомогти з підбором моделі квадрокоптера, акумуляторами та базовим навчанням екіпажу після передачі.',
    status: 'open',
    imageUrls: [],
    daysAgo: 2,
  },
  {
    author: '1000000004',
    postSlug: 'vehicle-request',
    title: 'Є набір інструментів і частина запчастин',
    description:
      'Можу передати комплект інструментів, ремені та кілька витратних позицій для обслуговування авто. За потреби допоможу з пошуком ще однієї станції техобслуговування.',
    status: 'open',
    imageUrls: [DEMO_IMAGE_URLS.responseEquipment],
    daysAgo: 3,
  },
  {
    author: '1000000003',
    postSlug: 'vehicle-request',
    title: 'Допоможу з адресною передачею та закупівлею',
    description:
      'Можу взяти на себе координацію закупівлі дрібних запчастин і адресну передачу через знайому волонтерську логістику.',
    status: 'open',
    imageUrls: [],
    daysAgo: 3,
  },
  {
    author: '1000000004',
    postSlug: 'powerbank-request',
    title: 'Підберу павербанки та ліхтарі з наявності',
    description:
      'Є можливість швидко зібрати комплект павербанків на 20000 mAh і кілька налобних ліхтарів. Потрібно лише уточнити кількість користувачів.',
    status: 'open',
    imageUrls: [],
    daysAgo: 1,
  },
  {
    author: '1000000003',
    postSlug: 'powerbank-request',
    title: 'Можемо оперативно передати частину живлення',
    description:
      'У нас є кілька павербанків і кабелі, які можемо передати найближчим рейсом разом з іншою допомогою.',
    status: 'open',
    imageUrls: [DEMO_IMAGE_URLS.responseDelivery],
    daysAgo: 1,
  },
  {
    author: '1000000002',
    postSlug: 'thermal-request-closed',
    title: 'Тепловізор знайдено та передано підрозділу',
    description:
      'Через партнерську ініціативу вдалося знайти тепловізор у хорошому стані та передати його підрозділу разом із базовим комплектом живлення.',
    status: 'closed',
    imageUrls: [DEMO_IMAGE_URLS.responseEquipment],
    daysAgo: 7,
  },
];

const demoReports = [
  {
    author: '2000000002',
    postSlug: 'medical-request-closed',
    reportType: 'author',
    text:
      'Допомогу отримано в повному обсязі. Аптечки та турнікети передано особовому складу, частину комплектів уже розподілено між екіпажами мобільної групи.',
    imageUrls: [DEMO_IMAGE_URLS.reportResult],
    daysAgo: 4,
  },
  {
    author: '1000000001',
    postSlug: 'medical-request-closed',
    reportType: 'helper',
    text:
      'Закупівлю та передачу допомоги завершено. Перед відправленням перевірено склад кожної аптечки, після передачі отримано підтвердження від військової сторони.',
    imageUrls: [DEMO_IMAGE_URLS.reportHandover],
    daysAgo: 4,
  },
  {
    author: '2000000003',
    postSlug: 'thermal-request-closed',
    reportType: 'author',
    text:
      'Тепловізор отримано і введено в роботу під час нічних виїздів. Це значно підвищило безпечність спостереження та пересування екіпажу.',
    imageUrls: [DEMO_IMAGE_URLS.reportResult],
    daysAgo: 6,
  },
  {
    author: '1000000002',
    postSlug: 'thermal-request-closed',
    reportType: 'helper',
    text:
      'Передачу тепловізора та додаткового комплекту живлення виконано успішно. Після перевірки працездатності обладнання отримано підтвердження від військового користувача.',
    imageUrls: [DEMO_IMAGE_URLS.reportHandover],
    daysAgo: 6,
  },
];

function getDbConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost')
        ? false
        : { rejectUnauthorized: false },
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'lab-5.v2',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  };
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

async function ensureLookups(client) {
  await client.query(`
    INSERT INTO role (role_id, role_name)
    VALUES (1, 'Волонтер'), (2, 'Військовий')
    ON CONFLICT (role_id) DO UPDATE
    SET role_name = EXCLUDED.role_name
  `);

  await client.query(`
    INSERT INTO post_type (post_type_id, post_type_name)
    VALUES (1, 'Збір коштів'), (2, 'Запит на допомогу')
    ON CONFLICT (post_type_id) DO UPDATE
    SET post_type_name = EXCLUDED.post_type_name
  `);

  await client.query(`
    ALTER TABLE response
    ADD COLUMN IF NOT EXISTS response_status TEXT DEFAULT 'open'
  `);
}

async function getPreservedAdmin(client) {
  const result = await client.query(
    `
      SELECT *
      FROM app_user
      WHERE user_rnokpp = $1
      LIMIT 1
    `,
    [ADMIN_RNOKPP]
  );

  if (!result.rows[0]) {
    throw new Error(`Не знайдено адміністратора з РНОКПП ${ADMIN_RNOKPP}. Очищення зупинено.`);
  }

  return result.rows[0];
}

async function clearContent(client) {
  await client.query('DELETE FROM report_image');
  await client.query('DELETE FROM report');
  await client.query('DELETE FROM response_image');
  await client.query('DELETE FROM response');
  await client.query('DELETE FROM post_image');
  await client.query('DELETE FROM post_tag');
  await client.query('DELETE FROM post');
  await client.query('DELETE FROM user_tag');
  await client.query('DELETE FROM tag');
  await client.query('DELETE FROM app_user WHERE user_rnokpp <> $1', [ADMIN_RNOKPP]);
}

async function restoreAdmin(client, adminUser) {
  await client.query(
    `
      UPDATE app_user
      SET role_id = 1,
          user_name = $2,
          user_email = $3,
          password_hash = $4,
          user_description = $5,
          user_image_url = $6
      WHERE user_rnokpp = $1
    `,
    [
      adminUser.user_rnokpp,
      adminUser.user_name || 'Антон',
      adminUser.user_email,
      adminUser.password_hash,
      adminUser.user_description || 'Адміністратор і координатор системи.',
      adminUser.user_image_url || '/public/images/premium_photo-1689568126014-06fea9d5d341.jpg',
    ]
  );

  for (const tagName of antonTags) {
    const tagId = await getOrCreateTagId(client, tagName);
    await client.query('INSERT INTO user_tag (tag_id, user_rnokpp) VALUES ($1, $2)', [
      tagId,
      ADMIN_RNOKPP,
    ]);
  }
}

async function insertUsers(client) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

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
      [
        user.rnokpp,
        user.roleId,
        user.name,
        user.email,
        passwordHash,
        user.description,
        user.imageUrl,
      ]
    );

    for (const tagName of user.tags) {
      const tagId = await getOrCreateTagId(client, tagName);
      await client.query('INSERT INTO user_tag (tag_id, user_rnokpp) VALUES ($1, $2)', [
        tagId,
        user.rnokpp,
      ]);
    }
  }
}

async function insertPosts(client) {
  const postIdsBySlug = new Map();

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

    postIdsBySlug.set(post.slug, postId);

    for (const tagName of post.tags) {
      const tagId = await getOrCreateTagId(client, tagName);
      await client.query('INSERT INTO post_tag (tag_id, post_id) VALUES ($1, $2)', [tagId, postId]);
    }

    for (const imageUrl of post.imageUrls) {
      const imageId = await getNextId(client, 'post_image', 'post_image_id');
      await client.query(
        'INSERT INTO post_image (post_image_id, post_id, post_image_url) VALUES ($1, $2, $3)',
        [imageId, postId, imageUrl]
      );
    }
  }

  return postIdsBySlug;
}

async function insertResponses(client, postIdsBySlug) {
  for (const response of demoResponses) {
    const responseId = await getNextId(client, 'response', 'response_id');
    const createdAt = new Date(Date.now() - response.daysAgo * 24 * 60 * 60 * 1000);
    const postId = postIdsBySlug.get(response.postSlug);

    await client.query(
      `
        INSERT INTO response (
          response_id,
          user_rnokpp,
          post_id,
          response_title,
          response_description,
          response_datetime,
          response_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        responseId,
        response.author,
        postId,
        response.title,
        response.description,
        createdAt,
        response.status,
      ]
    );

    for (const imageUrl of response.imageUrls) {
      const imageId = await getNextId(client, 'response_image', 'response_image_id');
      await client.query(
        `
          INSERT INTO response_image (response_image_id, response_id, response_image_url)
          VALUES ($1, $2, $3)
        `,
        [imageId, responseId, imageUrl]
      );
    }
  }
}

async function insertReports(client, postIdsBySlug) {
  for (const report of demoReports) {
    const reportId = await getNextId(client, 'report', 'report_number');
    const createdAt = new Date(Date.now() - report.daysAgo * 24 * 60 * 60 * 1000);
    const postId = postIdsBySlug.get(report.postSlug);

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
      [reportId, report.author, postId, report.reportType, report.text, createdAt]
    );

    for (const imageUrl of report.imageUrls) {
      const imageId = await getNextId(client, 'report_image', 'report_image_id');
      await client.query(
        `
          INSERT INTO report_image (report_image_id, report_number, report_image_url)
          VALUES ($1, $2, $3)
        `,
        [imageId, reportId, imageUrl]
      );
    }
  }
}

function validateDemoAssets() {
  const missingPaths = Object.values(DEMO_IMAGE_URLS)
    .map((url) => url.replace('/public/', ''))
    .map((relativePath) => path.join(__dirname, '..', 'public', relativePath))
    .filter((filePath) => !fs.existsSync(filePath));

  if (missingPaths.length) {
    throw new Error(
      `Не знайдено демонстраційні зображення: ${missingPaths.join(', ')}. Спочатку скопіюй файли до public/images/demo.`
    );
  }
}

async function main() {
  validateDemoAssets();

  const client = new Client(getDbConfig());
  await client.connect();

  try {
    await client.query('BEGIN');
    await ensureLookups(client);

    const preservedAdmin = await getPreservedAdmin(client);

    await clearContent(client);
    await restoreAdmin(client, preservedAdmin);
    await insertUsers(client);
    const postIdsBySlug = await insertPosts(client);
    await insertResponses(client, postIdsBySlug);
    await insertReports(client, postIdsBySlug);

    await client.query('COMMIT');

    console.log('Локальна БД очищена та заповнена розширеними демонстраційними даними.');
    console.log(`Адміністратор збережений: ${preservedAdmin.user_email}`);
    console.log(`Демо-пароль для нових користувачів: ${DEMO_PASSWORD}`);
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
