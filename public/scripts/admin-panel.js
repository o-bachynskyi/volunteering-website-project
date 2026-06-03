(function attachAdminPanel() {
  const state = {
    hasAccess: false,
    users: [],
    posts: [],
    responses: [],
    reports: [],
    accessRequest: null,
    filters: {
      userSearch: '',
      userRole: 'all',
      userSort: 'name-asc',
      userRemovableOnly: false,
      postSearch: '',
      postType: 'all',
      postStatus: 'all',
      postSort: 'date-desc',
      postRemovableOnly: false,
      responseSearch: '',
      responseStatus: 'all',
      responseSort: 'date-desc',
      reportSearch: '',
      reportType: 'all',
      reportSort: 'date-desc',
    },
  };

  function escapeHtml(text = '') {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function normalizeSearch(value = '') {
    return String(value || '').trim().toLowerCase();
  }

  function getCurrentUser() {
    return window.AuthState?.getUser?.() || null;
  }

  function getAdminNav() {
    return document.getElementById('admin-div');
  }

  function isAdminPageOpen() {
    return localStorage.getItem('selectedPage') === 'admin';
  }

  function toggleAdminNav(isVisible) {
    getAdminNav()?.classList.toggle('hidden', !isVisible);
  }

  function getFeedbackElement() {
    return document.getElementById('admin-feedback');
  }

  function setFeedback(message, type = 'success') {
    const element = getFeedbackElement();
    if (!element) return;

    if (!message) {
      element.textContent = '';
      element.classList.add('hidden');
      element.classList.remove('is-success', 'is-error');
      return;
    }

    element.textContent = message;
    element.classList.remove('hidden');
    element.classList.toggle('is-success', type === 'success');
    element.classList.toggle('is-error', type === 'error');
  }

  function formatDate(value) {
    if (!value) return 'Дата невідома';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Дата невідома';
    }

    return date.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function buildTags(tags = []) {
    if (!tags.length) return '';

    return `
      <div class="admin-tags">
        ${tags.map((tag) => `<span class="admin-tag">${escapeHtml(tag)}</span>`).join('')}
      </div>
    `;
  }

  function getUserActivity(user) {
    return Number(user.postCount || 0) + Number(user.responseCount || 0) + Number(user.reportCount || 0);
  }

  function isUserInactive(user) {
    return getUserActivity(user) === 0;
  }

  function isUserRemovable(user) {
    const currentUser = getCurrentUser();
    const isCurrentAdmin = currentUser?.rnokpp === user.rnokpp;
    const hasLinkedActivity = getUserActivity(user) > 0;
    return !isCurrentAdmin && !hasLinkedActivity && !user.isProtectedAdmin;
  }

  function isPostRemovable(post) {
    return Number(post.responseCount || 0) === 0 && Number(post.reportCount || 0) === 0;
  }

  function getFilteredUsers() {
    const query = normalizeSearch(state.filters.userSearch);
    const users = state.users.filter((user) => {
      if (state.filters.userRole !== 'all' && user.role_code !== state.filters.userRole) {
        return false;
      }

      if (state.filters.userRemovableOnly && !isUserRemovable(user)) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        user.full_name,
        user.email,
        user.rnokpp,
        user.role_name,
        ...(Array.isArray(user.tags) ? user.tags : []),
      ].map(normalizeSearch);

      return haystack.some((value) => value.includes(query));
    });

    users.sort((left, right) => {
      switch (state.filters.userSort) {
        case 'name-desc':
          return normalizeSearch(right.full_name).localeCompare(normalizeSearch(left.full_name), 'uk');
        case 'activity-desc':
          if (getUserActivity(right) !== getUserActivity(left)) {
            return getUserActivity(right) - getUserActivity(left);
          }
          return normalizeSearch(left.full_name).localeCompare(normalizeSearch(right.full_name), 'uk');
        case 'role': {
          const roleCompare = normalizeSearch(left.role_name).localeCompare(normalizeSearch(right.role_name), 'uk');
          if (roleCompare !== 0) return roleCompare;
          return normalizeSearch(left.full_name).localeCompare(normalizeSearch(right.full_name), 'uk');
        }
        case 'name-asc':
        default:
          return normalizeSearch(left.full_name).localeCompare(normalizeSearch(right.full_name), 'uk');
      }
    });

    return users;
  }

  function getFilteredPosts() {
    const query = normalizeSearch(state.filters.postSearch);
    const posts = state.posts.filter((post) => {
      if (state.filters.postType !== 'all' && post.type !== state.filters.postType) return false;

      if (state.filters.postStatus !== 'all') {
        const isClosed = post.status === 'closed';
        if (state.filters.postStatus === 'closed' && !isClosed) return false;
        if (state.filters.postStatus === 'open' && isClosed) return false;
      }

      if (state.filters.postRemovableOnly && !isPostRemovable(post)) return false;
      if (!query) return true;

      const haystack = [
        post.title,
        post.description,
        post.authorName,
        post.authorRole,
        post.typeName,
        ...(Array.isArray(post.tags) ? post.tags : []),
      ].map(normalizeSearch);

      return haystack.some((value) => value.includes(query));
    });

    posts.sort((left, right) => {
      switch (state.filters.postSort) {
        case 'date-asc':
          return new Date(left.createdAtIso || left.createdAt || 0).getTime() - new Date(right.createdAtIso || right.createdAt || 0).getTime();
        case 'responses-desc':
          if (Number(right.responseCount || 0) !== Number(left.responseCount || 0)) {
            return Number(right.responseCount || 0) - Number(left.responseCount || 0);
          }
          return new Date(right.createdAtIso || right.createdAt || 0).getTime() - new Date(left.createdAtIso || left.createdAt || 0).getTime();
        case 'reports-desc':
          if (Number(right.reportCount || 0) !== Number(left.reportCount || 0)) {
            return Number(right.reportCount || 0) - Number(left.reportCount || 0);
          }
          return new Date(right.createdAtIso || right.createdAt || 0).getTime() - new Date(left.createdAtIso || left.createdAt || 0).getTime();
        case 'title-asc':
          return normalizeSearch(left.title).localeCompare(normalizeSearch(right.title), 'uk');
        case 'date-desc':
        default:
          return new Date(right.createdAtIso || right.createdAt || 0).getTime() - new Date(left.createdAtIso || left.createdAt || 0).getTime();
      }
    });

    return posts;
  }

  function getFilteredResponses() {
    const query = normalizeSearch(state.filters.responseSearch);
    const responses = state.responses.filter((response) => {
      if (state.filters.responseStatus !== 'all' && response.status !== state.filters.responseStatus) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        response.responderName,
        response.responderRole,
        response.authorName,
        response.authorRole,
        response.title,
        response.responseTitle,
        response.responseDescription,
        ...(Array.isArray(response.tags) ? response.tags : []),
      ].map(normalizeSearch);

      return haystack.some((value) => value.includes(query));
    });

    responses.sort((left, right) => {
      switch (state.filters.responseSort) {
        case 'date-asc':
          return new Date(left.createdAtIso || left.createdAt || 0).getTime() - new Date(right.createdAtIso || right.createdAt || 0).getTime();
        case 'volunteer':
          return normalizeSearch(left.responderName).localeCompare(normalizeSearch(right.responderName), 'uk');
        case 'date-desc':
        default:
          return new Date(right.createdAtIso || right.createdAt || 0).getTime() - new Date(left.createdAtIso || left.createdAt || 0).getTime();
      }
    });

    return responses;
  }

  function getFilteredReports() {
    const query = normalizeSearch(state.filters.reportSearch);
    const reports = state.reports.filter((report) => {
      if (state.filters.reportType !== 'all' && report.reporterRole !== state.filters.reportType) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        report.reporterName,
        report.reportTitle,
        report.text,
        report.requestSnapshot?.title,
        report.requestSnapshot?.description,
        report.requestSnapshot?.authorName,
        ...(Array.isArray(report.requestSnapshot?.tags) ? report.requestSnapshot.tags : []),
      ].map(normalizeSearch);

      return haystack.some((value) => value.includes(query));
    });

    reports.sort((left, right) => {
      switch (state.filters.reportSort) {
        case 'date-asc':
          return new Date(left.createdAtIso || left.createdAt || 0).getTime() - new Date(right.createdAtIso || right.createdAt || 0).getTime();
        case 'reporter':
          return normalizeSearch(left.reporterName).localeCompare(normalizeSearch(right.reporterName), 'uk');
        case 'date-desc':
        default:
          return new Date(right.createdAtIso || right.createdAt || 0).getTime() - new Date(left.createdAtIso || left.createdAt || 0).getTime();
      }
    });

    return reports;
  }

  function setSummary() {
    const summaryMap = {
      'admin-users-count': state.users.length,
      'admin-posts-count': state.posts.length,
      'admin-open-requests-count': state.posts.filter((post) => post.type === 'request' && post.status !== 'closed').length,
      'admin-responses-count': state.responses.length,
      'admin-reports-count': state.reports.length,
      'admin-inactive-users-count': state.users.filter(isUserInactive).length,
    };

    Object.entries(summaryMap).forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = String(value);
    });

    const noteMap = {
      'admin-users-note': `${getFilteredUsers().length} після фільтрації`,
      'admin-posts-note': `${getFilteredPosts().length} після фільтрації`,
      'admin-open-requests-note': `${getFilteredPosts().filter((post) => post.type === 'request' && post.status !== 'closed').length} після фільтрації`,
      'admin-responses-note': `${getFilteredResponses().length} після фільтрації`,
      'admin-reports-note': `${getFilteredReports().length} після фільтрації`,
      'admin-inactive-users-note': 'без дописів, відгуків і звітів',
    };

    Object.entries(noteMap).forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    });
  }

  function buildUserCard(user) {
    const currentUser = getCurrentUser();
    const isCurrentAdmin = currentUser?.rnokpp === user.rnokpp;
    const hasLinkedActivity = getUserActivity(user) > 0;
    const removable = isUserRemovable(user);
    const disabledTitle = isCurrentAdmin
      ? 'Не можна видалити власний акаунт.'
      : user.isProtectedAdmin
        ? 'Захищений адміністратор не може бути видалений.'
        : hasLinkedActivity
          ? 'Користувач має пов’язані дописи, відгуки або звіти.'
          : '';

    return `
      <article class="admin-user-card" data-user-rnokpp="${escapeHtml(user.rnokpp)}">
        <div class="admin-user-card-header">
          <div class="admin-user-meta">
            <h3 class="admin-user-name">${escapeHtml(user.full_name)}</h3>
            <p class="admin-user-email">${escapeHtml(user.email || 'Електронна пошта не вказана')}</p>
            <span class="admin-user-role">${escapeHtml(user.role_name)}</span>
          </div>
        </div>
        <div class="admin-card-stats">
          <div class="admin-stat">
            <p class="admin-stat-label">Дописи</p>
            <p class="admin-stat-value">${user.postCount}</p>
          </div>
          <div class="admin-stat">
            <p class="admin-stat-label">Відгуки</p>
            <p class="admin-stat-value">${user.responseCount}</p>
          </div>
          <div class="admin-stat">
            <p class="admin-stat-label">Звіти</p>
            <p class="admin-stat-value">${user.reportCount}</p>
          </div>
        </div>
        ${buildTags(user.tags || [])}
        <div class="admin-card-actions">
          <button type="button" class="button admin-secondary-button admin-view-user-button" data-user-rnokpp="${escapeHtml(user.rnokpp)}">
            Деталі
          </button>
          <button
            type="button"
            class="button admin-danger-button admin-delete-user-button"
            data-user-rnokpp="${escapeHtml(user.rnokpp)}"
            ${removable ? '' : 'disabled'}
            title="${escapeHtml(disabledTitle)}"
          >
            Видалити
          </button>
        </div>
      </article>
    `;
  }

  function buildPostCard(post) {
    const removable = isPostRemovable(post);
    const typeClass = post.type === 'request' ? 'is-request' : 'is-fundraising';
    const statusClass = post.status === 'closed' ? 'is-closed' : 'is-open';
    const typeLabel = post.typeName || (post.type === 'request' ? 'Запит на допомогу' : 'Збір коштів');
    const statusLabel = post.status === 'closed' ? 'Закритий' : 'Активний';

    return `
      <article class="admin-post-card" data-post-id="${escapeHtml(post.postId)}">
        <div class="admin-post-card-header">
          <div class="admin-post-meta">
            <h3 class="admin-post-title">${escapeHtml(post.title || 'Без назви')}</h3>
            <p class="admin-post-author">${escapeHtml(post.authorName || 'Користувач')} • ${escapeHtml(post.authorRole || 'Роль невідома')}</p>
          </div>
          <div class="admin-post-badges">
            <span class="admin-post-badge ${typeClass}">${escapeHtml(typeLabel)}</span>
            <span class="admin-post-badge ${statusClass}">${escapeHtml(statusLabel)}</span>
            <span class="admin-post-badge ${removable ? 'is-removable' : 'is-locked'}">
              ${removable ? 'Можна видалити' : 'Є пов’язана активність'}
            </span>
          </div>
        </div>
        <p class="admin-post-description">${escapeHtml(post.description || 'Опис відсутній.')}</p>
        <div class="admin-card-stats">
          <div class="admin-stat">
            <p class="admin-stat-label">Відгуки</p>
            <p class="admin-stat-value">${Number(post.responseCount || 0)}</p>
          </div>
          <div class="admin-stat">
            <p class="admin-stat-label">Звіти</p>
            <p class="admin-stat-value">${Number(post.reportCount || 0)}</p>
          </div>
          <div class="admin-stat">
            <p class="admin-stat-label">Створено</p>
            <p class="admin-stat-value">${escapeHtml(formatDate(post.createdAtIso || post.createdAt))}</p>
          </div>
        </div>
        ${buildTags(post.tags || [])}
        <div class="admin-card-actions">
          <button type="button" class="button admin-secondary-button admin-view-post-button" data-post-id="${escapeHtml(post.postId)}">
            Деталі
          </button>
          <button
            type="button"
            class="button admin-danger-button admin-delete-post-button"
            data-post-id="${escapeHtml(post.postId)}"
            ${removable ? '' : 'disabled'}
            title="${removable ? '' : 'Не можна видалити допис із пов’язаними відгуками або звітами.'}"
          >
            Видалити
          </button>
        </div>
      </article>
    `;
  }

  function buildResponseCard(response) {
    const statusClass = response.status === 'closed' ? 'is-closed' : 'is-open';

    return `
      <article class="admin-item-card" data-response-id="${escapeHtml(response.responseId)}">
        <div class="admin-item-card-header">
          <div class="admin-item-meta">
            <h3 class="admin-item-title">${escapeHtml(response.responseTitle || 'Відгук без заголовка')}</h3>
            <p class="admin-item-subtitle">Волонтер: ${escapeHtml(response.responderName)} • Запит: ${escapeHtml(response.title || 'Без назви')}</p>
          </div>
          <div class="admin-item-badges">
            <span class="admin-item-badge ${statusClass}">${response.status === 'closed' ? 'Закритий' : 'Відкритий'}</span>
          </div>
        </div>
        <p class="admin-item-text">${escapeHtml(response.responseDescription || 'Текст відгуку відсутній.')}</p>
        <div class="admin-card-actions">
          <button type="button" class="button admin-secondary-button admin-view-response-button" data-response-id="${escapeHtml(response.responseId)}">
            Деталі
          </button>
        </div>
      </article>
    `;
  }

  function buildReportCard(report) {
    const typeClass = report.reporterRole === 'helper' ? 'is-helper' : 'is-author';

    return `
      <article class="admin-item-card" data-report-id="${escapeHtml(report.reportId)}">
        <div class="admin-item-card-header">
          <div class="admin-item-meta">
            <h3 class="admin-item-title">${escapeHtml(report.reportTitle || 'Звіт')}</h3>
            <p class="admin-item-subtitle">Автор: ${escapeHtml(report.reporterName || 'Користувач')} • Запит: ${escapeHtml(report.requestSnapshot?.title || 'Без назви')}</p>
          </div>
          <div class="admin-item-badges">
            <span class="admin-item-badge ${typeClass}">${report.reporterRole === 'helper' ? 'Від волонтера' : 'Від автора запиту'}</span>
          </div>
        </div>
        <p class="admin-item-text">${escapeHtml(report.text || 'Текст звіту відсутній.')}</p>
        <div class="admin-card-actions">
          <button type="button" class="button admin-secondary-button admin-view-report-button" data-report-id="${escapeHtml(report.reportId)}">
            Деталі
          </button>
        </div>
      </article>
    `;
  }

  function renderEmptyState(container, title, text) {
    if (!container) return;

    container.innerHTML = `
      <div class="admin-empty-state">
        <p class="admin-empty-title">${escapeHtml(title)}</p>
        <p class="admin-empty-text">${escapeHtml(text)}</p>
      </div>
    `;
  }

  function renderUsers() {
    const container = document.getElementById('admin-users-list');
    if (!container) return;

    const users = getFilteredUsers();
    if (!users.length) {
      renderEmptyState(container, 'Користувачів не знайдено', 'Спробуй змінити фільтри або очистити пошуковий запит.');
      return;
    }

    container.innerHTML = users.map(buildUserCard).join('');
  }

  function renderPosts() {
    const container = document.getElementById('admin-posts-list');
    if (!container) return;

    const posts = getFilteredPosts();
    if (!posts.length) {
      renderEmptyState(container, 'Дописи не знайдено', 'За поточними фільтрами немає дописів для відображення.');
      return;
    }

    container.innerHTML = posts.map(buildPostCard).join('');
  }

  function renderResponses() {
    const container = document.getElementById('admin-responses-list');
    if (!container) return;

    const responses = getFilteredResponses();
    if (!responses.length) {
      renderEmptyState(container, 'Відгуків не знайдено', 'За поточними фільтрами немає відгуків для відображення.');
      return;
    }

    container.innerHTML = responses.map(buildResponseCard).join('');
  }

  function renderReports() {
    const container = document.getElementById('admin-reports-list');
    if (!container) return;

    const reports = getFilteredReports();
    if (!reports.length) {
      renderEmptyState(container, 'Звітів не знайдено', 'За поточними фільтрами немає звітів для відображення.');
      return;
    }

    container.innerHTML = reports.map(buildReportCard).join('');
  }

  function applyFilters() {
    renderUsers();
    renderPosts();
    renderResponses();
    renderReports();
    setSummary();
  }

  function bindFilterValues() {
    const mapping = [
      ['admin-user-search', 'value', 'userSearch'],
      ['admin-user-role-filter', 'value', 'userRole'],
      ['admin-user-sort', 'value', 'userSort'],
      ['admin-user-removable-filter', 'checked', 'userRemovableOnly'],
      ['admin-post-search', 'value', 'postSearch'],
      ['admin-post-type-filter', 'value', 'postType'],
      ['admin-post-status-filter', 'value', 'postStatus'],
      ['admin-post-sort', 'value', 'postSort'],
      ['admin-post-removable-filter', 'checked', 'postRemovableOnly'],
      ['admin-response-search', 'value', 'responseSearch'],
      ['admin-response-status-filter', 'value', 'responseStatus'],
      ['admin-response-sort', 'value', 'responseSort'],
      ['admin-report-search', 'value', 'reportSearch'],
      ['admin-report-type-filter', 'value', 'reportType'],
      ['admin-report-sort', 'value', 'reportSort'],
    ];

    mapping.forEach(([id, prop, key]) => {
      const element = document.getElementById(id);
      if (element) {
        element[prop] = state.filters[key];
      }
    });
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || `Request failed: ${response.status}`);
    }
    return result;
  }

  async function fetchAdminUsers(force = false) {
    if (!window.AuthState?.isLoggedIn()) {
      state.hasAccess = false;
      state.users = [];
      state.posts = [];
      state.responses = [];
      state.reports = [];
      toggleAdminNav(false);
      return false;
    }

    if (state.accessRequest && !force) {
      return state.accessRequest;
    }

    state.accessRequest = (async () => {
      try {
        const result = await fetchJson('/users/admin');
        state.hasAccess = true;
        state.users = Array.isArray(result.users) ? result.users : [];
        toggleAdminNav(true);
        return true;
      } catch (error) {
        console.error('Помилка завантаження панелі адміністратора:', error);
        state.hasAccess = false;
        state.users = [];
        state.posts = [];
        state.responses = [];
        state.reports = [];
        toggleAdminNav(false);
        return false;
      } finally {
        state.accessRequest = null;
      }
    })();

    return state.accessRequest;
  }

  async function fetchPosts() {
    try {
      const result = await fetchJson('/posts');
      state.posts = Array.isArray(result.posts) ? result.posts : [];
    } catch (error) {
      console.error('Помилка завантаження дописів для адміністратора:', error);
      state.posts = [];
    }
  }

  async function fetchResponses() {
    try {
      const result = await fetchJson('/responses/admin');
      state.responses = Array.isArray(result.responses) ? result.responses : [];
    } catch (error) {
      console.error('Помилка завантаження відгуків для адміністратора:', error);
      state.responses = [];
    }
  }

  async function fetchReports() {
    try {
      const result = await fetchJson('/reports/admin');
      state.reports = Array.isArray(result.reports) ? result.reports : [];
    } catch (error) {
      console.error('Помилка завантаження звітів для адміністратора:', error);
      state.reports = [];
    }
  }

  function getModalNodes() {
    return {
      overlay: document.getElementById('admin-modal-overlay'),
      modal: document.getElementById('admin-modal'),
      title: document.getElementById('admin-modal-title'),
      body: document.getElementById('admin-modal-body'),
      actions: document.getElementById('admin-modal-actions'),
    };
  }

  function closeAdminModal() {
    const { overlay, modal, actions } = getModalNodes();
    overlay?.classList.add('hidden');
    modal?.classList.add('hidden');
    document.body.classList.remove('modal-open');
    if (actions) {
      actions.innerHTML = '';
    }
  }

  function openAdminModal({ title, bodyHtml, actions = [] }) {
    const nodes = getModalNodes();
    if (!nodes.overlay || !nodes.modal || !nodes.title || !nodes.body || !nodes.actions) {
      return;
    }

    nodes.title.textContent = title;
    nodes.body.innerHTML = bodyHtml;
    nodes.actions.innerHTML = '';

    actions.forEach((action) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `button ${action.className || 'admin-secondary-button'}`;
      button.textContent = action.label;
      button.addEventListener('click', async () => {
        try {
          await action.onClick?.();
        } finally {
          if (action.closeOnClick !== false) {
            closeAdminModal();
          }
        }
      });
      nodes.actions.appendChild(button);
    });

    nodes.overlay.classList.remove('hidden');
    nodes.modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function buildMiniList(items, renderItem, emptyText) {
    if (!items.length) {
      return `<p class="admin-modal-copy">${escapeHtml(emptyText)}</p>`;
    }

    return `
      <ul class="admin-modal-list">
        ${items.map(renderItem).join('')}
      </ul>
    `;
  }

  function showUserDetails(user) {
    const userPosts = state.posts.filter((post) => post.authorId === user.rnokpp).slice(0, 5);
    const userResponses = state.responses.filter((response) => response.responderId === user.rnokpp).slice(0, 5);
    const userReports = state.reports.filter((report) => report.reporterId === user.rnokpp).slice(0, 5);

    openAdminModal({
      title: `Користувач: ${user.full_name}`,
      bodyHtml: `
        <div class="admin-modal-pills">
          <span class="admin-modal-pill">${escapeHtml(user.role_name)}</span>
          ${isUserInactive(user) ? '<span class="admin-modal-pill is-closed">Без активності</span>' : '<span class="admin-modal-pill is-open">Є активність</span>'}
        </div>
        <div class="admin-modal-grid">
          <div class="admin-modal-grid-item">
            <p class="admin-modal-grid-label">РНОКПП</p>
            <p class="admin-modal-grid-value">${escapeHtml(user.rnokpp)}</p>
          </div>
          <div class="admin-modal-grid-item">
            <p class="admin-modal-grid-label">Email</p>
            <p class="admin-modal-grid-value">${escapeHtml(user.email || 'Не вказано')}</p>
          </div>
          <div class="admin-modal-grid-item">
            <p class="admin-modal-grid-label">Опис</p>
            <p class="admin-modal-grid-value">${escapeHtml(user.description || 'Не заповнено')}</p>
          </div>
        </div>
        ${buildTags(user.tags || [])}
        <div class="admin-modal-stats">
          <div class="admin-stat"><p class="admin-stat-label">Дописи</p><p class="admin-stat-value">${user.postCount}</p></div>
          <div class="admin-stat"><p class="admin-stat-label">Відгуки</p><p class="admin-stat-value">${user.responseCount}</p></div>
          <div class="admin-stat"><p class="admin-stat-label">Звіти</p><p class="admin-stat-value">${user.reportCount}</p></div>
        </div>
        <section class="admin-modal-section">
          <h3 class="admin-modal-section-title">Останні дописи</h3>
          ${buildMiniList(
            userPosts,
            (post) => `<li class="admin-modal-list-item"><p class="admin-modal-list-title">${escapeHtml(post.title || 'Без назви')}</p><p class="admin-modal-list-text">${escapeHtml(post.typeName || '')} • ${escapeHtml(formatDate(post.createdAtIso || post.createdAt))}</p></li>`,
            'У користувача ще немає дописів.'
          )}
        </section>
        <section class="admin-modal-section">
          <h3 class="admin-modal-section-title">Останні відгуки</h3>
          ${buildMiniList(
            userResponses,
            (response) => `<li class="admin-modal-list-item"><p class="admin-modal-list-title">${escapeHtml(response.responseTitle || 'Відгук без заголовка')}</p><p class="admin-modal-list-text">${escapeHtml(response.title || 'Без назви запиту')} • ${escapeHtml(formatDate(response.createdAtIso || response.createdAt))}</p></li>`,
            'У користувача ще немає відгуків.'
          )}
        </section>
        <section class="admin-modal-section">
          <h3 class="admin-modal-section-title">Останні звіти</h3>
          ${buildMiniList(
            userReports,
            (report) => `<li class="admin-modal-list-item"><p class="admin-modal-list-title">${escapeHtml(report.reportTitle || 'Звіт')}</p><p class="admin-modal-list-text">${escapeHtml(report.requestSnapshot?.title || 'Без назви')} • ${escapeHtml(formatDate(report.createdAtIso || report.createdAt))}</p></li>`,
            'У користувача ще немає звітів.'
          )}
        </section>
      `,
      actions: [
        { label: 'Закрити', className: 'admin-secondary-button' },
      ],
    });
  }

  function showPostDetails(post) {
    const postResponses = state.responses.filter((response) => String(response.requestId) === String(post.postId));
    const postReports = state.reports.filter((report) => String(report.requestId) === String(post.postId));
    const removable = isPostRemovable(post);

    openAdminModal({
      title: `Допис: ${post.title || 'Без назви'}`,
      bodyHtml: `
        <div class="admin-modal-pills">
          <span class="admin-modal-pill ${post.type === 'request' ? 'is-request' : 'is-fundraising'}">${escapeHtml(post.typeName || post.type)}</span>
          <span class="admin-modal-pill ${post.status === 'closed' ? 'is-closed' : 'is-open'}">${post.status === 'closed' ? 'Закритий' : 'Активний'}</span>
          <span class="admin-modal-pill ${removable ? 'is-open' : 'is-closed'}">${removable ? 'Можна видалити' : 'Є пов’язана активність'}</span>
        </div>
        <div class="admin-modal-grid">
          <div class="admin-modal-grid-item">
            <p class="admin-modal-grid-label">Автор</p>
            <p class="admin-modal-grid-value">${escapeHtml(post.authorName || 'Користувач')}</p>
          </div>
          <div class="admin-modal-grid-item">
            <p class="admin-modal-grid-label">Роль автора</p>
            <p class="admin-modal-grid-value">${escapeHtml(post.authorRole || 'Не визначено')}</p>
          </div>
          <div class="admin-modal-grid-item">
            <p class="admin-modal-grid-label">Створено</p>
            <p class="admin-modal-grid-value">${escapeHtml(formatDate(post.createdAtIso || post.createdAt))}</p>
          </div>
        </div>
        ${buildTags(post.tags || [])}
        <section class="admin-modal-section">
          <h3 class="admin-modal-section-title">Опис</h3>
          <p class="admin-modal-copy">${escapeHtml(post.description || 'Опис відсутній.')}</p>
        </section>
        <section class="admin-modal-section">
          <h3 class="admin-modal-section-title">Пов’язані відгуки</h3>
          ${buildMiniList(
            postResponses,
            (response) => `<li class="admin-modal-list-item"><p class="admin-modal-list-title">${escapeHtml(response.responseTitle || 'Відгук')}</p><p class="admin-modal-list-text">${escapeHtml(response.responderName)} • ${escapeHtml(formatDate(response.createdAtIso || response.createdAt))}</p></li>`,
            'Для цього допису ще немає відгуків.'
          )}
        </section>
        <section class="admin-modal-section">
          <h3 class="admin-modal-section-title">Пов’язані звіти</h3>
          ${buildMiniList(
            postReports,
            (report) => `<li class="admin-modal-list-item"><p class="admin-modal-list-title">${escapeHtml(report.reportTitle || 'Звіт')}</p><p class="admin-modal-list-text">${escapeHtml(report.reporterName || 'Користувач')} • ${escapeHtml(formatDate(report.createdAtIso || report.createdAt))}</p></li>`,
            'Для цього допису ще немає звітів.'
          )}
        </section>
      `,
      actions: [
        { label: 'Закрити', className: 'admin-secondary-button' },
      ],
    });
  }

  function showResponseDetails(response) {
    openAdminModal({
      title: `Відгук: ${response.responseTitle || 'Без заголовка'}`,
      bodyHtml: `
        <div class="admin-modal-pills">
          <span class="admin-modal-pill ${response.status === 'closed' ? 'is-closed' : 'is-open'}">${response.status === 'closed' ? 'Закритий' : 'Відкритий'}</span>
        </div>
        <div class="admin-modal-grid">
          <div class="admin-modal-grid-item">
            <p class="admin-modal-grid-label">Волонтер</p>
            <p class="admin-modal-grid-value">${escapeHtml(response.responderName)}</p>
          </div>
          <div class="admin-modal-grid-item">
            <p class="admin-modal-grid-label">Автор запиту</p>
            <p class="admin-modal-grid-value">${escapeHtml(response.authorName)}</p>
          </div>
          <div class="admin-modal-grid-item">
            <p class="admin-modal-grid-label">Створено</p>
            <p class="admin-modal-grid-value">${escapeHtml(formatDate(response.createdAtIso || response.createdAt))}</p>
          </div>
        </div>
        ${buildTags(response.tags || [])}
        <section class="admin-modal-section">
          <h3 class="admin-modal-section-title">Запит</h3>
          <p class="admin-modal-copy"><strong>${escapeHtml(response.title || 'Без назви')}</strong><br>${escapeHtml(response.description || 'Опис відсутній.')}</p>
        </section>
        <section class="admin-modal-section">
          <h3 class="admin-modal-section-title">Текст відгуку</h3>
          <p class="admin-modal-copy">${escapeHtml(response.responseDescription || 'Текст відгуку відсутній.')}</p>
        </section>
      `,
      actions: [
        { label: 'Закрити', className: 'admin-secondary-button' },
      ],
    });
  }

  function showReportDetails(report) {
    openAdminModal({
      title: report.reportTitle || 'Звіт',
      bodyHtml: `
        <div class="admin-modal-pills">
          <span class="admin-modal-pill ${report.reporterRole === 'helper' ? 'is-helper' : 'is-author'}">
            ${report.reporterRole === 'helper' ? 'Від волонтера' : 'Від автора запиту'}
          </span>
        </div>
        <div class="admin-modal-grid">
          <div class="admin-modal-grid-item">
            <p class="admin-modal-grid-label">Автор звіту</p>
            <p class="admin-modal-grid-value">${escapeHtml(report.reporterName || 'Користувач')}</p>
          </div>
          <div class="admin-modal-grid-item">
            <p class="admin-modal-grid-label">Роль автора</p>
            <p class="admin-modal-grid-value">${escapeHtml(report.reporterUserRole || 'Не визначено')}</p>
          </div>
          <div class="admin-modal-grid-item">
            <p class="admin-modal-grid-label">Створено</p>
            <p class="admin-modal-grid-value">${escapeHtml(formatDate(report.createdAtIso || report.createdAt))}</p>
          </div>
        </div>
        ${buildTags(report.requestSnapshot?.tags || [])}
        <section class="admin-modal-section">
          <h3 class="admin-modal-section-title">Пов’язаний запит</h3>
          <p class="admin-modal-copy"><strong>${escapeHtml(report.requestSnapshot?.title || 'Без назви')}</strong><br>${escapeHtml(report.requestSnapshot?.description || 'Опис відсутній.')}</p>
        </section>
        <section class="admin-modal-section">
          <h3 class="admin-modal-section-title">Текст звіту</h3>
          <p class="admin-modal-copy">${escapeHtml(report.text || 'Текст звіту відсутній.')}</p>
        </section>
      `,
      actions: [
        { label: 'Закрити', className: 'admin-secondary-button' },
      ],
    });
  }

  function openDeleteConfirmation({ title, message, confirmLabel, onConfirm }) {
    openAdminModal({
      title,
      bodyHtml: `<p class="admin-modal-copy">${escapeHtml(message)}</p>`,
      actions: [
        { label: 'Скасувати', className: 'admin-secondary-button' },
        { label: confirmLabel, className: 'admin-danger-button', onClick: onConfirm },
      ],
    });
  }

  async function loadAdminPage() {
    const usersContainer = document.getElementById('admin-users-list');
    const postsContainer = document.getElementById('admin-posts-list');
    const responsesContainer = document.getElementById('admin-responses-list');
    const reportsContainer = document.getElementById('admin-reports-list');
    if (!usersContainer || !postsContainer || !responsesContainer || !reportsContainer) {
      return;
    }

    setFeedback('');
    bindFilterValues();
    window.LoadingUi?.showSectionLoader(usersContainer, 'Завантажуємо користувачів...');
    window.LoadingUi?.showSectionLoader(postsContainer, 'Завантажуємо дописи...');
    window.LoadingUi?.showSectionLoader(responsesContainer, 'Завантажуємо відгуки...');
    window.LoadingUi?.showSectionLoader(reportsContainer, 'Завантажуємо звіти...');

    const hasAccess = await fetchAdminUsers(true);
    if (!hasAccess) {
      const message = window.AuthState?.isLoggedIn()
        ? 'Доступ до панелі дозволено лише адміністратору.'
        : 'Щоб відкрити панель адміністратора, потрібно увійти в систему.';

      [usersContainer, postsContainer, responsesContainer, reportsContainer].forEach((container) => {
        renderEmptyState(container, 'Доступ обмежено', message);
      });
      setSummary();
      return;
    }

    await Promise.all([
      fetchPosts(),
      fetchResponses(),
      fetchReports(),
    ]);

    applyFilters();
  }

  async function handleDeleteUser(button) {
    const rnokpp = String(button.dataset.userRnokpp || '').trim();
    if (!rnokpp) return;

    const user = state.users.find((item) => item.rnokpp === rnokpp);
    const userName = user?.full_name || 'цього користувача';

    openDeleteConfirmation({
      title: 'Підтвердження видалення',
      message: `Видалити користувача "${userName}"?`,
      confirmLabel: 'Видалити користувача',
      onConfirm: async () => {
        window.LoadingUi?.setButtonLoading(button, true, 'Видаляємо...');

        try {
          const result = await fetchJson(`/users/${encodeURIComponent(rnokpp)}`, {
            method: 'DELETE',
            credentials: 'same-origin',
          });
          setFeedback(result.message || 'Користувача видалено.');
          await loadAdminPage();
        } catch (error) {
          console.error('Помилка видалення користувача:', error);
          setFeedback(error.message || 'Не вдалося видалити користувача.', 'error');
        }
      },
    });
  }

  async function handleDeletePost(button) {
    const postId = String(button.dataset.postId || '').trim();
    if (!postId) return;

    const post = state.posts.find((item) => String(item.postId) === postId);
    const postTitle = post?.title || 'цей допис';

    openDeleteConfirmation({
      title: 'Підтвердження видалення',
      message: `Видалити допис "${postTitle}"?`,
      confirmLabel: 'Видалити допис',
      onConfirm: async () => {
        window.LoadingUi?.setButtonLoading(button, true, 'Видаляємо...');

        try {
          const result = await fetchJson(`/posts/${encodeURIComponent(postId)}`, {
            method: 'DELETE',
            credentials: 'same-origin',
          });
          setFeedback(result.message || 'Допис видалено.');
          await loadAdminPage();
        } catch (error) {
          console.error('Помилка видалення допису:', error);
          setFeedback(error.message || 'Не вдалося видалити допис.', 'error');
        }
      },
    });
  }

  document.addEventListener('input', (event) => {
    const inputMap = {
      'admin-user-search': 'userSearch',
      'admin-post-search': 'postSearch',
      'admin-response-search': 'responseSearch',
      'admin-report-search': 'reportSearch',
    };

    const key = inputMap[event.target.id];
    if (!key) return;

    state.filters[key] = event.target.value;
    applyFilters();
  });

  document.addEventListener('change', (event) => {
    const selectMap = {
      'admin-user-role-filter': 'userRole',
      'admin-user-sort': 'userSort',
      'admin-post-type-filter': 'postType',
      'admin-post-status-filter': 'postStatus',
      'admin-post-sort': 'postSort',
      'admin-response-status-filter': 'responseStatus',
      'admin-response-sort': 'responseSort',
      'admin-report-type-filter': 'reportType',
      'admin-report-sort': 'reportSort',
    };

    if (event.target.id in selectMap) {
      state.filters[selectMap[event.target.id]] = event.target.value;
      applyFilters();
      return;
    }

    const checkboxMap = {
      'admin-user-removable-filter': 'userRemovableOnly',
      'admin-post-removable-filter': 'postRemovableOnly',
    };

    if (event.target.id in checkboxMap) {
      state.filters[checkboxMap[event.target.id]] = event.target.checked;
      applyFilters();
    }
  });

  document.addEventListener('click', (event) => {
    const refreshButton = event.target.closest('#admin-refresh-users-button, #admin-refresh-posts-button, #admin-refresh-responses-button, #admin-refresh-reports-button');
    if (refreshButton) {
      void loadAdminPage();
      return;
    }

    const closeModalTrigger = event.target.closest('#admin-modal-close-button') || event.target.id === 'admin-modal-overlay';
    if (closeModalTrigger) {
      closeAdminModal();
      return;
    }

    const viewUserButton = event.target.closest('.admin-view-user-button');
    if (viewUserButton) {
      const user = state.users.find((item) => item.rnokpp === String(viewUserButton.dataset.userRnokpp || '').trim());
      if (user) showUserDetails(user);
      return;
    }

    const viewPostButton = event.target.closest('.admin-view-post-button');
    if (viewPostButton) {
      const post = state.posts.find((item) => String(item.postId) === String(viewPostButton.dataset.postId || '').trim());
      if (post) showPostDetails(post);
      return;
    }

    const viewResponseButton = event.target.closest('.admin-view-response-button');
    if (viewResponseButton) {
      const response = state.responses.find((item) => String(item.responseId) === String(viewResponseButton.dataset.responseId || '').trim());
      if (response) showResponseDetails(response);
      return;
    }

    const viewReportButton = event.target.closest('.admin-view-report-button');
    if (viewReportButton) {
      const report = state.reports.find((item) => String(item.reportId) === String(viewReportButton.dataset.reportId || '').trim());
      if (report) showReportDetails(report);
      return;
    }

    const deleteUserButton = event.target.closest('.admin-delete-user-button');
    if (deleteUserButton) {
      void handleDeleteUser(deleteUserButton);
      return;
    }

    const deletePostButton = event.target.closest('.admin-delete-post-button');
    if (deletePostButton) {
      void handleDeletePost(deletePostButton);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAdminModal();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    void fetchAdminUsers();
  });

  document.addEventListener('page:loaded', (event) => {
    if (event.detail?.page === 'admin') {
      void loadAdminPage();
    }
  });

  document.addEventListener('auth:changed', async (event) => {
    if (!event.detail?.authenticated) {
      state.hasAccess = false;
      state.users = [];
      state.posts = [];
      state.responses = [];
      state.reports = [];
      toggleAdminNav(false);
      return;
    }

    await fetchAdminUsers(true);
    if (isAdminPageOpen()) {
      await loadAdminPage();
    }
  });
})();
