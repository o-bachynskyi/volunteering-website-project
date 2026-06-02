(function () {
  let currentUserLoad = null;

  function escapeHtml(text = '') {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function buildTags(tags = []) {
    if (!tags.length) {
      return '<p class="public-profile-empty">Теги поки що не додано.</p>';
    }

    return tags.map((tag) => `
      <div class="profile-tag">
        <p class="profile-tag-title">${escapeHtml(tag)}</p>
      </div>
    `).join('');
  }

  function ensureProfileViewer() {
    let overlay = document.getElementById('public-profile-overlay');
    let modal = document.getElementById('public-profile-modal');

    if (overlay && modal) {
      return { overlay, modal };
    }

    overlay = document.createElement('div');
    overlay.id = 'public-profile-overlay';
    overlay.className = 'modal-overlay hidden public-profile-overlay';

    modal = document.createElement('div');
    modal.id = 'public-profile-modal';
    modal.className = 'public-profile-modal-window hidden';
    modal.innerHTML = `
      <button type="button" class="close-modal-button public-profile-close" aria-label="Закрити профіль">
        <img src="/public/images/close-modal-icon.png" alt="Close profile">
      </button>
      <div class="public-profile-content" id="public-profile-content"></div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    const close = () => {
      overlay.classList.add('hidden');
      modal.classList.add('hidden');
      document.body.classList.remove('modal-open');
    };

    overlay.addEventListener('click', close);
    modal.querySelector('.public-profile-close')?.addEventListener('click', close);

    return { overlay, modal };
  }

  function renderProfile(user) {
    return `
      <section class="public-profile-card">
        <header class="public-profile-header">
          <img src="${escapeHtml(user.image_url || '/public/images/account-icon.png')}" alt="Фото профілю" class="public-profile-image">
          <div class="public-profile-info">
            <p class="public-profile-name">${escapeHtml(user.full_name || 'Користувач')}</p>
            <p class="public-profile-role">${escapeHtml(user.role_name || 'Роль не визначена')}</p>
            <div class="profile-tags public-profile-tags">${buildTags(user.tags || [])}</div>
          </div>
        </header>
        <div class="profile-divider public-profile-divider">
          <hr class="line">
          <span class="divider-text">ОПИС</span>
          <hr class="line">
        </div>
        <p class="public-profile-description">${escapeHtml(user.description || 'Опис поки що не заповнений.')}</p>
      </section>
    `;
  }

  async function openUserProfile(userId) {
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) return;

    const { overlay, modal } = ensureProfileViewer();
    const content = modal.querySelector('#public-profile-content');
    if (!content) return;

    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    content.innerHTML = '<p class="public-profile-loading">Завантажуємо профіль...</p>';

    try {
      currentUserLoad = fetch(`/users/${encodeURIComponent(normalizedUserId)}`, {
        credentials: 'same-origin',
      });
      const response = await currentUserLoad;
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Не вдалося завантажити профіль.');
      }

      content.innerHTML = renderProfile(result.user || result);
    } catch (error) {
      console.error('Помилка відкриття профілю:', error);
      content.innerHTML = `<p class="public-profile-empty">${escapeHtml(error.message || 'Не вдалося завантажити профіль.')}</p>`;
    } finally {
      currentUserLoad = null;
    }
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('.user-profile-open');
    if (!trigger) return;

    event.preventDefault();
    event.stopPropagation();
    void openUserProfile(trigger.dataset.userId);
  });
})();
