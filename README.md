# Volunteering Website Project

Дипломний проєкт вебплатформи для взаємодії волонтерів і військових.

## Гілки

- `main` — стабільна версія, до якої проєкт було відкочено. У цій гілці є інтерфейс звітів, але без поточних доробок бекенду.
- `backend-work` — поточна робоча версія. У цій гілці фронтенд-заглушки для основних сценаріїв підключені до реального бекенду і PostgreSQL.

Перемикання між версіями:

```powershell
git switch main
```

```powershell
git switch backend-work
```

## Що вже працює в `backend-work`

- реєстрація користувача
- вхід у систему через сесію
- перегляд і редагування власного профілю
- створення, редагування і видалення власних дописів
- окремі стрічки для зборів і запитів на допомогу
- відгук на запит
- сторінка прийнятих запитів
- створення звітів
- сторінка звітів
- списки військових і волонтерів

## Опис гілки `backend-work`

У цій гілці зібрано стабілізацію основних сценаріїв сайту та доробку зв’язку фронтенду з бекендом і БД. Основна мета змін — зробити проєкт придатним до нормального локального використання і подальшої підготовки до захисту.

Що реалізовано:

- виправлено рольову логіку:
  - `Запит на допомогу` може створювати лише військовий
  - `Відгук` на запит може залишати лише волонтер
- виправлено створення, редагування і видалення дописів
- додано захист від видалення дописів, які вже мають пов’язані відгуки або звіти
- реалізовано динамічне відображення часу створення дописів
- додано пошук по тексту і тегах
- додано лоадери для завантаження і submit-дій
- виправлено пряме відкриття сторінок без `404`
- виправлено нескінченне завантаження профілю
- уніфіковано роботу із зображеннями:
  - у дописах дозволені лише фото
  - `GIF` і відео для дописів заборонені
  - максимум `5` фото на один допис
  - для аватара теж дозволені лише фото
- перевірено роботу відгуків, звітів і профільних дописів
- додано базові покращення для зручності локальної розробки і тестування

Для чого ця гілка:

- `main` залишається стабільною базовою версією
- `backend-work` використовується як основна гілка активної доробки функціоналу

Поточний статус:

- локально сайт працює на `http://localhost:3000`
- основні сценарії перевірені
- гілка готова до подальшої доробки бекенду та фінального полірування

## Технології

- `Node.js`
- `Express`
- `PostgreSQL`
- фронтенд на HTML/CSS/JavaScript без фреймворку

## Запуск

### Швидкий старт

Для нового користувача найпростіший спосіб локально підняти проєкт:

1. Склонуйте репозиторій і перейдіть у папку проєкту:

```powershell
git clone https://github.com/o-bachynskyi/volunteering-website-project.git
cd volunteering-website-project
git switch backend-work
```

2. Запустіть автоматичну локальну підготовку:

```powershell
npm run setup:local -- -DbPassword YOUR_POSTGRES_PASSWORD
```

Що робить ця команда:

- встановлює `npm`-залежності
- створює `.env`, якщо його ще немає
- підставляє локальні параметри БД у `.env`
- перевіряє, чи існує база `lab-5.v2`
- створює базу, якщо її ще немає
- імпортує `neon-import.sql`, якщо таблиці ще не створені

Якщо не передавати `-DbPassword`, скрипт сам попросить ввести пароль від PostgreSQL.

Якщо потрібно примусово заново переімпортувати дамп:

```powershell
npm run setup:local -- -DbPassword YOUR_POSTGRES_PASSWORD -ReimportDump
```

3. Запустіть сервер:

```powershell
npm start
```

4. Відкрийте сайт:

- `http://localhost:3000`
- `http://localhost:3000/health`

### Ручний запуск

1. Перейти в папку проєкту:

```powershell
cd "D:\VS Code Projects\volunteering-website-project-main"
```

2. Встановити залежності:

```powershell
npm install
```

3. Створити локальний `.env` на основі шаблону:

```powershell
Copy-Item .env.example .env
```

4. Заповнити в `.env` потрібні значення для БД та пошти.

5. Запустити сервер:

```powershell
npm start
```

Після запуску сайт доступний за адресою:

`http://localhost:3000`

Перевірка сервера:

`http://localhost:3000/health`

## Підключення до БД

Поточна конфігурація в [backend/db.js](D:\VS Code Projects\volunteering-website-project-main\backend\db.js:1):

- `host`: `localhost`
- `port`: `5432`
- `database`: `lab-5.v2`
- `user`: `postgres`

## Демо-дані

У гілці `backend-work` доданий скрипт для оновлення демонстраційних даних:

```powershell
node scripts/refresh-demo-data.js
```

Скрипт:

- прибирає старі технічні демо-записи
- створює демонстраційних користувачів
- додає приклади зборів і запитів, схожі на старі заглушки

## Email-сповіщення про відгук

Після створення нового відгуку бекенд може надіслати автору запиту лист на email.

Для цього потрібно задати змінні в `.env`:

```env
MAILJET_API_KEY=your_mailjet_api_key
MAILJET_SECRET_KEY=your_mailjet_secret_key
SMTP_FROM=Volunteering Website <verified_sender@example.com>
APP_BASE_URL=http://localhost:3000
```

Примітка:

- зараз у проєкті вже використовується `Mailjet API`
- якщо змінні пошти не задані, відгук все одно збережеться в БД, але лист не відправиться

## Корисні маршрути

- `GET /health`
- `GET /posts`
- `GET /posts?type=fundraising`
- `GET /posts?type=request`
- `GET /users?role=military`
- `GET /users?role=volunteers`
- `GET /auth/session`

## Примітка

У проєкті ще можуть залишатися окремі старі статичні тексти або візуальні дрібниці, але основний робочий сценарій у `backend-work` уже переведений із заглушок на реальні дані з бази.
## Render Deploy

This repository includes a ready `render.yaml` for a free Render web service in the `frankfurt` region.

Recommended branch for deploy:

- `backend-work`

Required environment variables in Render:

- `DATABASE_URL`
- `MAILJET_API_KEY`
- `MAILJET_SECRET_KEY`
- `SMTP_FROM`
- `APP_BASE_URL`

Recommended values:

- `DATABASE_URL` = your Neon connection string
- `SMTP_FROM` = `Volunteering Website <ipz22-a.bachynskyi@nubip.edu.ua>`
- `APP_BASE_URL` = your Render public URL, for example `https://your-service.onrender.com`

The service uses:

- build command: `npm install`
- start command: `npm start`
- health check path: `/health`
