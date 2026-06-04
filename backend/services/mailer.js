const nodemailer = require('nodemailer');

let transporterPromise = null;
let missingConfigLogged = false;

function getMailConfig() {
  return {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
    resendApiKey: process.env.RESEND_API_KEY || '',
    mailjetApiKey: process.env.MAILJET_API_KEY || '',
    mailjetSecretKey: process.env.MAILJET_SECRET_KEY || '',
  };
}

function hasMailjetApi(config = getMailConfig()) {
  return Boolean(config.mailjetApiKey && config.mailjetSecretKey && config.from);
}

function hasResendApi(config = getMailConfig()) {
  return Boolean(config.resendApiKey && config.from);
}

function isSmtpConfigured(config = getMailConfig()) {
  return Boolean(config.host && config.port && config.user && config.pass && config.from);
}

async function getTransporter() {
  if (!transporterPromise) {
    const config = getMailConfig();
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      })
    );
  }

  return transporterPromise;
}

async function sendViaMailjetApi(message, config) {
  const auth = Buffer.from(`${config.mailjetApiKey}:${config.mailjetSecretKey}`).toString('base64');
  const fromEmailMatch = config.from.match(/<([^>]+)>/);
  const fromName = config.from.includes('<') ? config.from.split('<')[0].trim() : '';
  const fromEmail = fromEmailMatch ? fromEmailMatch[1] : config.from.trim();

  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Messages: [
        {
          From: {
            Email: fromEmail,
            ...(fromName ? { Name: fromName } : {}),
          },
          To: (Array.isArray(message.to) ? message.to : [message.to]).map((email) => ({
            Email: email,
          })),
          Subject: message.subject,
          TextPart: message.text,
          HTMLPart: message.html,
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details =
      payload?.Messages?.[0]?.Errors?.map((entry) => entry?.ErrorMessage || entry?.ErrorIdentifier).filter(Boolean).join('; ')
      || payload?.ErrorMessage
      || payload?.message
      || response.statusText;
    throw new Error(`Mailjet API error: ${response.status} ${details}`);
  }

  return payload;
}

async function sendViaResendApi(message, config) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: Array.isArray(message.to) ? message.to : [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = payload?.message || payload?.error || response.statusText;
    throw new Error(`Resend API error: ${response.status} ${details}`);
  }

  return payload;
}

async function sendMail(message) {
  const config = getMailConfig();

  if (hasMailjetApi(config)) {
    return sendViaMailjetApi(message, config);
  }

  if (hasResendApi(config)) {
    return sendViaResendApi(message, config);
  }

  if (!isSmtpConfigured(config)) {
    if (!missingConfigLogged) {
      console.warn('Email notifications are disabled because email environment variables are not configured.');
      missingConfigLogged = true;
    }

    return { skipped: true };
  }

  const transporter = await getTransporter();
  return transporter.sendMail({
    from: config.from,
    ...message,
  });
}

function buildResponseNotificationText({
  postOwnerName,
  responderName,
  responderEmail,
  postTitle,
  responseTitle,
  responseDescription,
  projectUrl,
}) {
  return [
    `Вітаємо${postOwnerName ? `, ${postOwnerName}` : ''}!`,
    '',
    'На ваш запит надійшов новий відгук.',
    '',
    `Запит: ${postTitle || 'Без назви'}`,
    `Відгук від: ${responderName || 'Користувач'}`,
    `Заголовок відгуку: ${responseTitle || 'Без заголовка'}`,
    '',
    'Текст відгуку:',
    responseDescription || 'Без опису',
    '',
    `Пошта для зв'язку: ${responderEmail || 'Не вказана'}`,
    '',
    `Перевірити можна тут: ${projectUrl}`,
  ].join('\n');
}

function buildResponseNotificationHtml({
  postOwnerName,
  responderName,
  responderEmail,
  postTitle,
  responseTitle,
  responseDescription,
  projectUrl,
}) {
  return `
    <div style="font-family: Arial, sans-serif; color: #1f1f1f; line-height: 1.5;">
      <h2 style="margin-bottom: 12px;">Новий відгук на ваш запит</h2>
      <p>Вітаємо${postOwnerName ? `, <strong>${postOwnerName}</strong>` : ''}!</p>
      <p>На ваш запит надійшов новий відгук.</p>
      <p><strong>Запит:</strong> ${postTitle || 'Без назви'}</p>
      <p><strong>Відгук від:</strong> ${responderName || 'Користувач'}</p>
      <p><strong>Заголовок відгуку:</strong> ${responseTitle || 'Без заголовка'}</p>
      <p><strong>Текст відгуку:</strong></p>
      <p>${responseDescription || 'Без опису'}</p>
      <p><strong>Пошта для зв'язку:</strong> ${responderEmail || 'Не вказана'}</p>
      <p><a href="${projectUrl}">Відкрити сайт</a></p>
    </div>
  `;
}

async function sendResponseNotification({
  postOwnerEmail,
  postOwnerName,
  responderName,
  responderEmail,
  postTitle,
  responseTitle,
  responseDescription,
}) {
  if (!postOwnerEmail) {
    return { skipped: true };
  }

  const projectUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const subject = `Новий відгук на ваш запит: ${postTitle || 'без назви'}`;

  return sendMail({
    to: postOwnerEmail,
    subject,
    text: buildResponseNotificationText({
      postOwnerName,
      responderName,
      responderEmail,
      postTitle,
      responseTitle,
      responseDescription,
      projectUrl,
    }),
    html: buildResponseNotificationHtml({
      postOwnerName,
      responderName,
      responderEmail,
      postTitle,
      responseTitle,
      responseDescription,
      projectUrl,
    }),
  });
}

module.exports = {
  sendResponseNotification,
};
