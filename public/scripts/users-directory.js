(function () {
  const state = {
    military: [],
    volunteers: [],
    loading: {},
  };

  function escapeHtml(text = '') {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function buildTags(tags = []) {
    return tags.map((tag) => `
      <div class="user-tag">
        <p class="user-tag-title">${escapeHtml(tag)}</p>
      </div>
    `).join('');
  }

  function buildUserCard(user) {
    return `
      <a href="#" class="user-card-link">
        <article class="user-card">
          <div class="card-content">
            <img src="${escapeHtml(user.image_url)}" alt="User Profile Picture" class="profile-pic">
            <div class="card-data">
              <div class="user-data">
                <p class="user-name">${escapeHtml(user.full_name)}</p>
              </div>
            </div>
          </div>
          <div class="user-tags">${buildTags(user.tags || [])}</div>
        </article>
      </a>
    `;
  }

  function normalizeSearchText(value = '') {
    return value == null ? '' : String(value).trim().toLowerCase();
  }

  function getSearchState() {
    return window.SearchState?.getState?.() || { query: '', tags: [] };
  }

  function isSearchActive() {
    const { query, tags } = getSearchState();
    return Boolean(query || tags.length);
  }

  function userMatchesSearch(user) {
    const { query, tags } = getSearchState();
    const userTags = Array.isArray(user.tags) ? user.tags.map((tag) => normalizeSearchText(tag)) : [];
    const queryMatches = !query || [
      user.full_name,
      user.description,
      user.role,
    ].some((value) => normalizeSearchText(value).includes(query));
    const tagsMatch = !tags.length || tags.every((tag) => userTags.includes(tag));
    return queryMatches && tagsMatch;
  }

  function renderSearchEmptyState(container, message) {
    container.innerHTML = `
      <div class="search-empty-state">
        <p class="search-empty-state-title">${escapeHtml(message)}</p>
      </div>
    `;
  }

  async function loadUsers(role) {
    if (state.loading[role]) {
      return state.loading[role];
    }

    state.loading[role] = (async () => {
      try {
        const response = await fetch(`/users?role=${encodeURIComponent(role)}`, {
          credentials: 'same-origin',
        });

        if (!response.ok) {
          throw new Error(`Failed to load ${role}: ${response.status}`);
        }

        const result = await response.json();
        state[role] = Array.isArray(result.users) ? result.users : [];
      } catch (error) {
        console.error(`Помилка завантаження списку ${role}:`, error);
        state[role] = [];
      } finally {
        state.loading[role] = null;
      }

      return state[role];
    })();

    return state.loading[role];
  }

  function renderUsers(role, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const users = state[role].filter(userMatchesSearch);

    if (!users.length && isSearchActive()) {
      const label = role === 'military' ? 'військових' : 'волонтерів';
      renderSearchEmptyState(container, `За вашим запитом ${label} не знайдено.`);
      return;
    }

    container.innerHTML = users.map(buildUserCard).join('');
  }

  async function syncUsersDirectory() {
    window.LoadingUi?.showSectionLoader(
      document.getElementById('military-users-list'),
      'Завантажуємо список військових...'
    );
    window.LoadingUi?.showSectionLoader(
      document.getElementById('volunteer-users-list'),
      'Завантажуємо список волонтерів...'
    );

    await Promise.all([
      loadUsers('military'),
      loadUsers('volunteers'),
    ]);

    renderUsers('military', 'military-users-list');
    renderUsers('volunteers', 'volunteer-users-list');
  }

  document.addEventListener('DOMContentLoaded', () => {
    void syncUsersDirectory();
  });

  document.addEventListener('page:loaded', () => {
    void syncUsersDirectory();
  });

  document.addEventListener('search:changed', () => {
    renderUsers('military', 'military-users-list');
    renderUsers('volunteers', 'volunteer-users-list');
  });
})();
