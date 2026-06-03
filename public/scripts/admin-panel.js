(function attachAdminPanel() {
  const state = {
    hasAccess: false,
    users: [],
    posts: [],
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
    if (!element) {
      return;
    }

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

  function isUserRemovable(user) {
    const currentUser = getCurrentUser();
    const isCurrentAdmin = currentUser?.rnokpp === user.rnokpp;
    const hasLinkedActivity = user.postCount > 0 || user.responseCount > 0 || user.reportCount > 0;
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

      if (!query) {
        return true;
      }

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
        case 'activity-desc': {
          const leftActivity = Number(left.postCount || 0) + Number(left.responseCount || 0) + Number(left.reportCount || 0);
          const rightActivity = Number(right.postCount || 0) + Number(right.responseCount || 0) + Number(right.reportCount || 0);
          if (rightActivity !== leftActivity) {
            return rightActivity - leftActivity;
          }
          return normalizeSearch(left.full_name).localeCompare(normalizeSearch(right.full_name), 'uk');
        }
        case 'role': {
          const roleCompare = normalizeSearch(left.role_name).localeCompare(normalizeSearch(right.role_name), 'uk');
          if (roleCompare !== 0) {
            return roleCompare;
          }
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
      if (state.filters.postType !== 'all' && post.type !== state.filters.postType) {
        return false;
      }

      if (state.filters.postStatus !== 'all') {
        const isClosed = post.status === 'closed';
        if (state.filters.postStatus === 'closed' && !isClosed) {
          return false;
        }
        if (state.filters.postStatus === 'open' && isClosed) {
          return false;
        }
      }

      if (state.filters.postRemovableOnly && !isPostRemovable(post)) {
        return false;
      }

      if (!query) {
        return true;
      }

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

  function setSummary() {
    const usersCountElement = document.getElementById('admin-users-count');
    const postsCountElement = document.getElementById('admin-posts-count');
    const openRequestsCountElement = document.getElementById('admin-open-requests-count');
    const usersNoteElement = document.getElementById('admin-users-note');
    const postsNoteElement = document.getElementById('admin-posts-note');
    const openRequestsNoteElement = document.getElementById('admin-open-requests-note');

    if (!usersCountElement || !postsCountElement || !openRequestsCountElement) {
      return;
    }

    const filteredUsers = getFilteredUsers();
    const filteredPosts = getFilteredPosts();
    const totalOpenRequestCount = state.posts.filter((post) => post.type === 'request' && post.status !== 'closed').length;
    const filteredOpenRequestCount = filteredPosts.filter((post) => post.type === 'request' && post.status !== 'closed').length;

    usersCountElement.textContent = String(state.users.length);
    postsCountElement.textContent = String(state.posts.length);
    openRequestsCountElement.textContent = String(totalOpenRequestCount);

    if (usersNoteElement) {
      usersNoteElement.textContent = `${filteredUsers.length} після фільтрації`;
    }

    if (postsNoteElement) {
      postsNoteElement.textContent = `${filteredPosts.length} після фільтрації`;
    }

    if (openRequestsNoteElement) {
      openRequestsNoteElement.textContent = `${filteredOpenRequestCount} після фільтрації`;
    }
  }

  function formatDate(value) {
    if (!value) {
      return 'Дата невідома';
    }

    try {
      return new Date(value).toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return 'Дата невідома';
    }
  }

  function buildTags(tags = []) {
    if (!tags.length) {
      return '';
    }

    return `
      <div class="admin-tags">
        ${tags.map((tag) => `<span class="admin-tag">${escapeHtml(tag)}</span>`).join('')}
      </div>
    `;
  }

  function buildUserCard(user) {
    const currentUser = getCurrentUser();
    const isCurrentAdmin = currentUser?.rnokpp === user.rnokpp;
    const hasLinkedActivity = user.postCount > 0 || user.responseCount > 0 || user.reportCount > 0;
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
          <button
            type="button"
            class="button admin-danger-button admin-delete-user-button"
            data-user-rnokpp="${escapeHtml(user.rnokpp)}"
            ${removable ? '' : 'disabled'}
            title="${escapeHtml(disabledTitle)}"
          >
            Видалити користувача
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
            <p class="admin-post-author">
              ${escapeHtml(post.authorName || 'Користувач')} • ${escapeHtml(post.authorRole || 'Роль невідома')}
            </p>
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
          <button
            type="button"
            class="button admin-danger-button admin-delete-post-button"
            data-post-id="${escapeHtml(post.postId)}"
            ${removable ? '' : 'disabled'}
            title="${removable ? '' : 'Не можна видалити допис із пов’язаними відгуками або звітами.'}"
          >
            Видалити допис
          </button>
        </div>
      </article>
    `;
  }

  function renderEmptyState(container, title, text) {
    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="admin-empty-state">
        <p class="admin-empty-title">${escapeHtml(title)}</p>
        <p class="admin-empty-text">${escapeHtml(text)}</p>
      </div>
    `;
  }

  function renderUsers() {
    const container = document.getElementById('admin-users-list');
    if (!container) {
      return;
    }

    const users = getFilteredUsers();
    if (!users.length) {
      renderEmptyState(container, 'Користувачів не знайдено', 'Спробуй змінити фільтри або очистити пошуковий запит.');
      return;
    }

    container.innerHTML = users.map(buildUserCard).join('');
  }

  function renderPosts() {
    const container = document.getElementById('admin-posts-list');
    if (!container) {
      return;
    }

    const posts = getFilteredPosts();
    if (!posts.length) {
      renderEmptyState(container, 'Дописи не знайдено', 'За поточними фільтрами немає дописів для відображення.');
      return;
    }

    container.innerHTML = posts.map(buildPostCard).join('');
  }

  function applyFilters() {
    renderUsers();
    renderPosts();
    setSummary();
  }

  function bindFilterValues() {
    const userSearch = document.getElementById('admin-user-search');
    const userRole = document.getElementById('admin-user-role-filter');
    const userSort = document.getElementById('admin-user-sort');
    const userRemovable = document.getElementById('admin-user-removable-filter');
    const postSearch = document.getElementById('admin-post-search');
    const postType = document.getElementById('admin-post-type-filter');
    const postStatus = document.getElementById('admin-post-status-filter');
    const postSort = document.getElementById('admin-post-sort');
    const postRemovable = document.getElementById('admin-post-removable-filter');

    if (userSearch) userSearch.value = state.filters.userSearch;
    if (userRole) userRole.value = state.filters.userRole;
    if (userSort) userSort.value = state.filters.userSort;
    if (userRemovable) userRemovable.checked = state.filters.userRemovableOnly;
    if (postSearch) postSearch.value = state.filters.postSearch;
    if (postType) postType.value = state.filters.postType;
    if (postStatus) postStatus.value = state.filters.postStatus;
    if (postSort) postSort.value = state.filters.postSort;
    if (postRemovable) postRemovable.checked = state.filters.postRemovableOnly;
  }

  async function fetchAdminUsers(force = false) {
    if (!window.AuthState?.isLoggedIn()) {
      state.hasAccess = false;
      state.users = [];
      state.posts = [];
      toggleAdminNav(false);
      return false;
    }

    if (state.accessRequest && !force) {
      return state.accessRequest;
    }

    state.accessRequest = (async () => {
      try {
        const response = await fetch('/users/admin', {
          credentials: 'same-origin',
        });

        if (!response.ok) {
          state.hasAccess = false;
          state.users = [];
          state.posts = [];
          toggleAdminNav(false);
          return false;
        }

        const result = await response.json();
        state.hasAccess = true;
        state.users = Array.isArray(result.users) ? result.users : [];
        toggleAdminNav(true);
        return true;
      } catch (error) {
        console.error('Помилка завантаження панелі адміністратора:', error);
        state.hasAccess = false;
        state.users = [];
        state.posts = [];
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
      const response = await fetch('/posts', {
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error(`Failed to load posts: ${response.status}`);
      }

      const result = await response.json();
      state.posts = Array.isArray(result.posts) ? result.posts : [];
    } catch (error) {
      console.error('Помилка завантаження дописів для адміністратора:', error);
      state.posts = [];
    }
  }

  async function loadAdminPage() {
    const usersContainer = document.getElementById('admin-users-list');
    const postsContainer = document.getElementById('admin-posts-list');
    if (!usersContainer || !postsContainer) {
      return;
    }

    setFeedback('');
    bindFilterValues();
    window.LoadingUi?.showSectionLoader(usersContainer, 'Завантажуємо користувачів...');
    window.LoadingUi?.showSectionLoader(postsContainer, 'Завантажуємо дописи...');

    const hasAccess = await fetchAdminUsers(true);
    if (!hasAccess) {
      state.posts = [];
      const message = window.AuthState?.isLoggedIn()
        ? 'Доступ до панелі дозволено лише адміністратору.'
        : 'Щоб відкрити панель адміністратора, потрібно увійти в систему.';

      renderEmptyState(usersContainer, 'Доступ обмежено', message);
      renderEmptyState(postsContainer, 'Доступ обмежено', message);
      setSummary();
      return;
    }

    await fetchPosts();
    applyFilters();
  }

  async function handleDeleteUser(button) {
    const rnokpp = String(button.dataset.userRnokpp || '').trim();
    if (!rnokpp) {
      return;
    }

    const user = state.users.find((item) => item.rnokpp === rnokpp);
    const userName = user?.full_name || 'цього користувача';
    const isConfirmed = window.confirm(`Видалити користувача "${userName}"?`);
    if (!isConfirmed) {
      return;
    }

    window.LoadingUi?.setButtonLoading(button, true, 'Видаляємо...');

    try {
      const response = await fetch(`/users/${encodeURIComponent(rnokpp)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || 'Не вдалося видалити користувача.');
      }

      setFeedback(result.message || 'Користувача видалено.');
      await loadAdminPage();
    } catch (error) {
      console.error('Помилка видалення користувача:', error);
      setFeedback(error.message || 'Не вдалося видалити користувача.', 'error');
    }
  }

  async function handleDeletePost(button) {
    const postId = String(button.dataset.postId || '').trim();
    if (!postId) {
      return;
    }

    const post = state.posts.find((item) => String(item.postId) === postId);
    const postTitle = post?.title || 'цей допис';
    const isConfirmed = window.confirm(`Видалити допис "${postTitle}"?`);
    if (!isConfirmed) {
      return;
    }

    window.LoadingUi?.setButtonLoading(button, true, 'Видаляємо...');

    try {
      const response = await fetch(`/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || 'Не вдалося видалити допис.');
      }

      setFeedback(result.message || 'Допис видалено.');
      await loadAdminPage();
    } catch (error) {
      console.error('Помилка видалення допису:', error);
      setFeedback(error.message || 'Не вдалося видалити допис.', 'error');
    }
  }

  document.addEventListener('input', (event) => {
    if (event.target.matches('#admin-user-search')) {
      state.filters.userSearch = event.target.value;
      applyFilters();
      return;
    }

    if (event.target.matches('#admin-post-search')) {
      state.filters.postSearch = event.target.value;
      applyFilters();
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches('#admin-user-role-filter')) {
      state.filters.userRole = event.target.value;
      applyFilters();
      return;
    }

    if (event.target.matches('#admin-user-sort')) {
      state.filters.userSort = event.target.value;
      applyFilters();
      return;
    }

    if (event.target.matches('#admin-user-removable-filter')) {
      state.filters.userRemovableOnly = event.target.checked;
      applyFilters();
      return;
    }

    if (event.target.matches('#admin-post-type-filter')) {
      state.filters.postType = event.target.value;
      applyFilters();
      return;
    }

    if (event.target.matches('#admin-post-status-filter')) {
      state.filters.postStatus = event.target.value;
      applyFilters();
      return;
    }

    if (event.target.matches('#admin-post-sort')) {
      state.filters.postSort = event.target.value;
      applyFilters();
      return;
    }

    if (event.target.matches('#admin-post-removable-filter')) {
      state.filters.postRemovableOnly = event.target.checked;
      applyFilters();
    }
  });

  document.addEventListener('click', (event) => {
    const refreshUsersButton = event.target.closest('#admin-refresh-users-button');
    if (refreshUsersButton) {
      void loadAdminPage();
      return;
    }

    const refreshPostsButton = event.target.closest('#admin-refresh-posts-button');
    if (refreshPostsButton) {
      void loadAdminPage();
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
      toggleAdminNav(false);
      return;
    }

    await fetchAdminUsers(true);
    if (isAdminPageOpen()) {
      await loadAdminPage();
    }
  });
})();
