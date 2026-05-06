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

## Технології

- `Node.js`
- `Express`
- `PostgreSQL`
- фронтенд на HTML/CSS/JavaScript без фреймворку

## Запуск

1. Перейти в папку проєкту:

```powershell
cd "D:\VS Code Projects\volunteering-website-project-main"
```

2. Встановити залежності:

```powershell
npm install
```

3. Запустити сервер:

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
