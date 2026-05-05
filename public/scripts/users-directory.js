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

    container.innerHTML = state[role].map(buildUserCard).join('');
  }

  async function syncUsersDirectory() {
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
})();
