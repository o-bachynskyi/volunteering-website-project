const pool = require('../backend/db');
const { startServer } = require('../backend/index');

const tinyImage =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P8z8DwHwAFgwJ/lmV+2QAAAABJRU5ErkJggg==';

class SessionClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookie = '';
  }

  async request(path, options = {}) {
    const headers = {
      ...(options.headers || {}),
    };

    if (this.cookie) {
      headers.Cookie = this.cookie;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    const setCookies = response.headers.getSetCookie?.() || [];
    if (setCookies.length) {
      this.cookie = setCookies.map((entry) => entry.split(';')[0]).join('; ');
    } else {
      const singleCookie = response.headers.get('set-cookie');
      if (singleCookie) {
        this.cookie = singleCookie.split(';')[0];
      }
    }

    const raw = await response.text();
    let body = null;
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch (error) {
        body = raw;
      }
    }

    if (!response.ok) {
      throw new Error(
        `${options.method || 'GET'} ${path} failed: ${
          body?.message || response.statusText
        }`
      );
    }

    return body;
  }
}

async function main() {
  const server = await startServer();
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const author = new SessionClient(baseUrl);
  const helper = new SessionClient(baseUrl);
  const suffix = Date.now();

  try {
    const authorRnokpp = String(7000000000 + (suffix % 1000000000)).slice(0, 10);
    const helperRnokpp = String(8000000000 + (suffix % 1000000000)).slice(0, 10);

    const authorEmail = `demo.military.${suffix}@example.com`;
    const helperEmail = `demo.volunteer.${suffix}@example.com`;

    const authorRegistration = await author.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: `Demo Military ${suffix}`,
        rnokpp: authorRnokpp,
        email: authorEmail,
        password: 'password123',
        role_id: 'mi',
      }),
    });

    await author.request('/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: authorRegistration.user.full_name,
        description: 'Потрібна допомога для demo-сценарію.',
        image_url: tinyImage,
        tags: ['дрон', 'медицина'],
      }),
    });

    const createdPost = await author.request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'request',
        title: `Demo request ${suffix}`,
        description: 'Тестовий запит на допомогу для перевірки повного сценарію.',
        tags: ['demo', 'test'],
        images: [tinyImage],
      }),
    });

    await author.request('/auth/logout', { method: 'POST' });

    const helperRegistration = await helper.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: `Demo Volunteer ${suffix}`,
        rnokpp: helperRnokpp,
        email: helperEmail,
        password: 'password123',
        role_id: 'vo',
      }),
    });

    await helper.request('/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: helperRegistration.user.full_name,
        description: 'Готовий допомогти у demo-сценарії.',
        image_url: tinyImage,
        tags: ['логістика'],
      }),
    });

    const responseResult = await helper.request('/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_id: Number(createdPost.post.postId),
        title: `Demo response ${suffix}`,
        description: 'Відгук на тестовий запит.',
        images: [tinyImage],
      }),
    });

    const helperReport = await helper.request('/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_id: Number(createdPost.post.postId),
        response_id: Number(responseResult.response.responseId),
        reporter_role: 'helper',
        text: 'Волонтерський звіт для демонстрації.',
        images: [tinyImage],
        request_snapshot: {
          title: createdPost.post.title,
        },
      }),
    });

    const helperAccepted = await helper.request('/responses/mine');
    const helperReports = await helper.request('/reports/mine');
    await helper.request('/auth/logout', { method: 'POST' });

    await author.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: authorEmail,
        password: 'password123',
      }),
    });

    const authorReport = await author.request('/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_id: Number(createdPost.post.postId),
        reporter_role: 'author',
        text: 'Звіт автора запиту для демонстрації.',
        images: [tinyImage],
        request_snapshot: {
          title: createdPost.post.title,
        },
      }),
    });

    const authorPosts = await author.request('/posts');
    const authorReports = await author.request('/reports/mine');

    console.log(
      JSON.stringify(
        {
          ok: true,
          createdUsers: [authorEmail, helperEmail],
          requestId: createdPost.post.postId,
          responseId: responseResult.response.responseId,
          helperReportId: helperReport.report.reportId,
          authorReportId: authorReport.report.reportId,
          acceptedRequestsLoaded: helperAccepted.acceptedRequests.length,
          helperReportsLoaded: helperReports.reports.length,
          totalPostsVisible: authorPosts.posts.length,
          authorReportsLoaded: authorReports.reports.length,
        },
        null,
        2
      )
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
