(function () {
  const STORAGE_KEY = 'selectedPublicUserId';
  const DEFAULT_AVATAR = '/public/images/account-icon.png';

  function escapeHtml(text = '') {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function normalizeId(value) {
    return String(value || '').trim();
  }

  function getSelectedUserId() {
    return normalizeId(localStorage.getItem(STORAGE_KEY));
  }

  function setSelectedUserId(userId) {
    localStorage.setItem(STORAGE_KEY, normalizeId(userId));
  }

  function buildTags(tags = []) {
    if (!tags.length) {
      return '<p class="public-user-profile-empty">Теги поки що не додано.</p>';
    }

    return tags.map((tag) => `
      <div class="profile-tag">
        <p class="profile-tag-title">${escapeHtml(tag)}</p>
      </div>
    `).join('');
  }

  function formatDateText(value) {
    if (!value) {
      return 'Невідомо';
    }

    const timestamp = Number(value);
    if (Number.isFinite(timestamp)) {
      return new Intl.DateTimeFormat('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(timestamp));
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(parsed);
    }

    return String(value);
  }

  function buildImages(images = []) {
    return images.map((imageUrl) => `
      <img src="${escapeHtml(imageUrl)}" alt="Фото допису" class="photo">
    `).join('');
  }

  function buildPublicPostCard(post, user) {
    const isRequest = post.type === 'request';
    const isClosed = post.status === 'closed';

    return `
      <article class="post ${isRequest ? 'request-post-card' : ''}">
        <header class="post-header">
          <img src="${escapeHtml(user.image_url || DEFAULT_AVATAR)}" alt="Фото профілю" class="post-profile-pic">
          <div class="post-data">
            <div class="user-info">
              <p class="name">${escapeHtml(user.full_name || 'Користувач')}</p>
              <p class="dot">•</p>
              <time class="post-date">${escapeHtml(post.dateText || formatDateText(post.createdAt))}</time>
            </div>
            <p class="user-role">${escapeHtml(user.role_name || 'Користувач')}</p>
            ${isRequest ? `<p class="request-status ${isClosed ? 'is-closed' : 'is-open'}">${isClosed ? 'Закритий' : 'Відкритий'}</p>` : ''}
          </div>
        </header>
        <div class="post-content">
          ${post.tags?.length ? `<div class="profile-tags">${buildTags(post.tags)}</div>` : ''}
          <h2 class="post-title">${escapeHtml(post.title || 'Без назви')}</h2>
          <p class="post-description">${escapeHtml(post.description || '')}</p>
          ${post.images?.length ? `<section class="post-photos">${buildImages(post.images)}</section>` : ''}
        </div>
      </article>
    `;
  }

  function setProfileLoadingState(message) {
    const description = document.getElementById('public-user-profile-description');
    const postsContainer = document.getElementById('public-generated-profile-posts');
    if (description) {
      description.textContent = message;
    }
    if (postsContainer) {
      postsContainer.innerHTML = `<p class="public-user-profile-empty">${escapeHtml(message)}</p>`;
    }
  }

  async function loadJson(url) {
    const response = await fetch(url, {
      credentials: 'same-origin',
    });

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      const body = await response.text();
      throw new Error(body?.startsWith('<!DOCTYPE') ? 'Сторінку профілю не вдалося завантажити.' : 'Сервер повернув некоректну відповідь.');
    }

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Не вдалося завантажити дані.');
    }

    return result;
  }

  function populateProfile(user) {
    const avatar = document.getElementById('public-user-profile-avatar');
    const name = document.getElementById('public-user-profile-name');
    const role = document.getElementById('public-user-profile-role');
    const description = document.getElementById('public-user-profile-description');
    const tags = document.getElementById('public-user-profile-tags');

    if (avatar) avatar.src = user.image_url || DEFAULT_AVATAR;
    if (name) name.textContent = user.full_name || 'Користувач';
    if (role) role.textContent = user.role_name || 'Роль не визначена';
    if (description) description.textContent = user.description || 'Опис поки що не заповнений.';
    if (tags) tags.innerHTML = buildTags(user.tags || []);
  }

  function renderPosts(posts, user) {
    const container = document.getElementById('public-generated-profile-posts');
    if (!container) return;

    if (!posts.length) {
      container.innerHTML = '<p class="public-user-profile-empty">У цього користувача ще немає дописів.</p>';
      return;
    }

    container.innerHTML = posts.map((post) => buildPublicPostCard(post, user)).join('');
  }

  async function renderCurrentProfile() {
    const pageRoot = document.querySelector('.public-user-profile-page');
    if (!pageRoot) {
      return;
    }

    const userId = getSelectedUserId();
    if (!userId) {
      setProfileLoadingState('Не вибрано користувача для перегляду профілю.');
      return;
    }

    setProfileLoadingState('Завантажуємо профіль...');

    try {
      const [{ user }, postsResult] = await Promise.all([
        loadJson(`/users/${encodeURIComponent(userId)}`),
        loadJson('/posts'),
      ]);

      const posts = Array.isArray(postsResult.posts)
        ? postsResult.posts
            .filter((post) => normalizeId(post.authorId) === userId)
            .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
        : [];

      populateProfile(user || {});
      renderPosts(posts, user || {});
    } catch (error) {
      console.error('Помилка відкриття профілю:', error);
      setProfileLoadingState(error.message || 'Не вдалося завантажити профіль користувача.');
    }
  }

  function openUserProfile(userId) {
    const normalizedUserId = normalizeId(userId);
    if (!normalizedUserId) {
      return;
    }

    const currentUserId = normalizeId(window.AuthState?.getUser()?.rnokpp);
    if (currentUserId && currentUserId === normalizedUserId) {
      localStorage.setItem('selectedPage', 'user-profile');
      if (window.AppShell?.loadPage) {
        void window.AppShell.loadPage('user-profile');
      } else {
        window.location.href = '/public/pages/index.html';
      }
      return;
    }

    setSelectedUserId(normalizedUserId);
    localStorage.setItem('selectedPage', 'public-user-profile');

    if (window.AppShell?.loadPage) {
      void window.AppShell.loadPage('public-user-profile');
      return;
    }

    window.location.href = '/public/public-user-profile.html';
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('.user-profile-open');
    if (!trigger) return;

    event.preventDefault();
    event.stopPropagation();
    openUserProfile(trigger.dataset.userId);
  });

  document.addEventListener('page:loaded', () => {
    if (document.querySelector('.public-user-profile-page')) {
      void renderCurrentProfile();
    }
  });

  window.PublicUserProfile = {
    getSelectedUserId,
    openUserProfile,
    renderCurrentProfile,
  };
})();
