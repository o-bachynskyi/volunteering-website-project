(function () {
  const STORAGE_KEY = 'mock-request-flow-state';
  const STATE_VERSION = 3;
  const REPORT_TITLES = {
    author: 'Звіт про отримання допомоги',
    helper: 'Звіт про надання допомоги',
  };
  const DEMO_REQUEST_IDS = ['request-generator', 'request-medkits'];
  const runtimeState = {
    requestStatuses: {},
    acceptedRequests: {},
  };

  const defaultState = {
    version: STATE_VERSION,
    requestStatuses: {
      'profile-request-medical': 'open',
      'request-generator': 'open',
      'request-medkits': 'open',
    },
    generatedPosts: {},
    deletedOwnedPosts: {},
    acceptedRequests: {},
  };

  function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function stripDemoRequestState(map = {}) {
    return Object.fromEntries(
      Object.entries(map).filter(([key]) => !isDemoRequestId(key))
    );
  }

  function sanitizePersistedState(parsed = {}) {
    return {
      generatedPosts: { ...(parsed.generatedPosts || {}) },
      deletedOwnedPosts: { ...(parsed.deletedOwnedPosts || {}) },
      requestStatuses: stripDemoRequestState(parsed.requestStatuses || {}),
      acceptedRequests: stripDemoRequestState(parsed.acceptedRequests || {}),
    };
  }

  function getState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneState(defaultState);

      const parsed = JSON.parse(raw);
      const sanitized = sanitizePersistedState(parsed);
      if (parsed.version !== STATE_VERSION) {
        return {
          ...cloneState(defaultState),
          generatedPosts: sanitized.generatedPosts,
          deletedOwnedPosts: sanitized.deletedOwnedPosts,
          requestStatuses: { ...defaultState.requestStatuses, ...sanitized.requestStatuses },
        };
      }

      return {
        version: STATE_VERSION,
        requestStatuses: { ...defaultState.requestStatuses, ...sanitized.requestStatuses },
        generatedPosts: { ...defaultState.generatedPosts, ...sanitized.generatedPosts },
        deletedOwnedPosts: { ...defaultState.deletedOwnedPosts, ...sanitized.deletedOwnedPosts },
        acceptedRequests: { ...defaultState.acceptedRequests, ...sanitized.acceptedRequests },
      };
    } catch (error) {
      console.error('Помилка читання mock request state:', error);
      return cloneState(defaultState);
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STATE_VERSION,
      requestStatuses: stripDemoRequestState(state.requestStatuses),
      generatedPosts: state.generatedPosts,
      deletedOwnedPosts: state.deletedOwnedPosts,
      acceptedRequests: stripDemoRequestState(state.acceptedRequests),
    }));
  }

  function escapeHtml(text = '') {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function isDemoRequestId(requestId) {
    return DEMO_REQUEST_IDS.includes(requestId);
  }

  function buildTags(tags = []) {
    if (!tags.length) return '';

    return tags.map(tag => `
      <div class="profile-tag">
        <p class="profile-tag-title">${escapeHtml(tag)}</p>
      </div>
    `).join('');
  }

  function buildImages(images = []) {
    return images.map(imageUrl => `
      <img src="${escapeHtml(imageUrl)}" alt="post photo" class="photo">
    `).join('');
  }

  function buildAcceptedRequestCard(request) {
    const isClosed = request.status === 'closed';
    const closeButton = isClosed ? '' : `
      <button class="post-dropdown-item close-request-button" data-report-role="helper">
        <img src="/public/images/close-modal-icon.png" alt="close request">
        Закрити
      </button>
    `;

    return `
      <article class="post request-post-card" data-request-id="${escapeHtml(request.requestId)}" data-request-status="${escapeHtml(request.status)}" data-request-context="helper">
        <header class="post-header request-post-header">
          <div class="request-post-header-left">
            <img src="${escapeHtml(request.avatar)}" alt="User Profile Picture" class="post-profile-pic">
            <div class="post-data">
              <div class="user-info">
                <p class="name">${escapeHtml(request.authorName)}</p>
                <p class="dot">•</p>
                <time class="post-date">${escapeHtml(request.dateText)}</time>
              </div>
              <p class="user-role">${escapeHtml(request.authorRole)}</p>
              <p class="request-status ${isClosed ? 'is-closed' : 'is-open'}">${isClosed ? 'Закритий' : 'Відкритий'}</p>
            </div>
          </div>
          <div class="accepted-request-actions">
            <button class="post-more-button">
              <img src="/public/images/more-icon.png" alt="more">
            </button>
            <div class="post-more-dropdown hidden">
              ${closeButton}
              <button class="post-dropdown-item delete-accepted-request-button">
                <img src="/public/images/delete-icon.png" alt="delete request">
                Видалити
              </button>
            </div>
          </div>
        </header>
        <div class="post-content">
          ${request.tags?.length ? `<div class="profile-tags">${buildTags(request.tags)}</div>` : ''}
          <h2 class="post-title">${escapeHtml(request.title)}</h2>
          <p class="post-description">${escapeHtml(request.description)}</p>
          <section class="post-photos">${buildImages(request.images)}</section>
        </div>
      </article>
    `;
  }

  function buildRequestFeedCard(request) {
    const isClosed = request.status === 'closed';
    const editAction = isClosed ? '' : `
      <button class="post-dropdown-item edit-post-button">
        <img src="/public/images/edit-icon.png" alt="edit post">
        Редагувати
      </button>
    `;
    const closeAction = isClosed ? '' : `
      <button class="post-dropdown-item close-request-button" data-report-role="author">
        <img src="/public/images/close-modal-icon.png" alt="close request">
        Закрити
      </button>
    `;

    return `
      <article class="post request-post-card" data-request-id="${escapeHtml(request.postId)}" data-owned-post-id="${escapeHtml(request.postId)}" data-request-status="${escapeHtml(request.status)}" data-request-context="author-feed">
        <header class="request-post-header has-owner-actions">
          <div class="request-post-header-left">
            <img src="${escapeHtml(request.avatar)}" alt="User Profile Picture" class="post-profile-pic">
            <div class="post-data">
              <div class="user-info">
                <p class="name">Олег</p>
                <p class="dot">•</p>
                <time class="post-date">${escapeHtml(request.dateText)}</time>
              </div>
              <p class="user-role">Волонтер</p>
              <p class="request-status ${isClosed ? 'is-closed' : 'is-open'}">${isClosed ? 'Закритий' : 'Відкритий'}</p>
            </div>
          </div>
          <div class="accepted-request-actions">
            <button class="post-more-button">
              <img src="/public/images/more-icon.png" alt="more">
            </button>
            <div class="post-more-dropdown hidden">
              ${editAction}
              ${closeAction}
              <button class="post-dropdown-item delete-own-post-button">
                <img src="/public/images/delete-icon.png" alt="delete post">
                Видалити
              </button>
            </div>
          </div>
        </header>
        <div class="post-content">
          ${request.tags?.length ? `<div class="profile-tags">${buildTags(request.tags)}</div>` : ''}
          <h2 class="post-title">${escapeHtml(request.title)}</h2>
          <p class="post-description">${escapeHtml(request.description)}</p>
          <section class="post-photos">${buildImages(request.images)}</section>
        </div>
      </article>
    `;
  }

  function buildProfileGeneratedPostCard(post) {
    const isRequest = post.type === 'request';
    const isClosed = post.status === 'closed';
    const requestStatus = isRequest ? `<p class="request-status ${isClosed ? 'is-closed' : 'is-open'}">${isClosed ? 'Закритий' : 'Відкритий'}</p>` : '';
    const requestActions = isRequest && !isClosed ? `
      <button class="post-dropdown-item close-request-button" data-report-role="author">
        <img src="/public/images/close-modal-icon.png" alt="close request">
        Закрити
      </button>
    ` : '';

    return `
      <article class="post ${isRequest ? 'request-post-card' : ''}" data-owned-post-id="${escapeHtml(post.postId)}" ${isRequest ? `data-request-id="${escapeHtml(post.postId)}" data-request-status="${escapeHtml(post.status)}" data-request-context="author"` : ''}>
        <header class="post-header">
          <img src="${escapeHtml(post.avatar)}" alt="User Profile Picture" class="post-profile-pic">
          <div class="post-data">
            <div class="user-info">
              <p class="name">Олег</p>
              <p class="dot">•</p>
              <time class="post-date">${escapeHtml(post.dateText)}</time>
            </div>
            <p class="user-role">Волонтер</p>
            ${requestStatus}
            <button class="post-more-button">
              <img src="/public/images/more-icon.png" alt="more">
            </button>
            <div class="post-more-dropdown hidden">
              ${isRequest && isClosed ? '' : `
                <button class="post-dropdown-item edit-post-button">
                  <img src="/public/images/edit-icon.png" alt="edit post">
                  Редагувати
                </button>
              `}
              ${requestActions}
              <button class="post-dropdown-item delete-own-post-button">
                <img src="/public/images/delete-icon.png" alt="delete post">
                Видалити
              </button>
            </div>
          </div>
        </header>
        <div class="post-content">
          ${post.tags?.length ? `<div class="profile-tags">${buildTags(post.tags)}</div>` : ''}
          <h2 class="post-title">${escapeHtml(post.title)}</h2>
          <p class="post-description">${escapeHtml(post.description)}</p>
          <section class="post-photos">${buildImages(post.images)}</section>
        </div>
      </article>
    `;
  }

  function buildFundraiserCard(post) {
    return `
      <article class="post" data-owned-post-id="${escapeHtml(post.postId)}">
        <header class="post-header">
          <img src="${escapeHtml(post.avatar)}" alt="User Profile Picture" class="post-profile-pic">
          <div class="post-data">
            <div class="user-info">
              <p class="name">Олег</p>
              <p class="dot">•</p>
              <time class="post-date">${escapeHtml(post.dateText)}</time>
            </div>
            <p class="user-role">Волонтер</p>
            <button class="post-more-button">
              <img src="/public/images/more-icon.png" alt="more">
            </button>
            <div class="post-more-dropdown hidden">
              <button class="post-dropdown-item edit-post-button">
                <img src="/public/images/edit-icon.png" alt="edit post">
                Редагувати
              </button>
              <button class="post-dropdown-item delete-own-post-button">
                <img src="/public/images/delete-icon.png" alt="delete post">
                Видалити
              </button>
            </div>
          </div>
        </header>
        <div class="post-content">
          ${post.tags?.length ? `<div class="profile-tags">${buildTags(post.tags)}</div>` : ''}
          <h2 class="post-title">${escapeHtml(post.title)}</h2>
          <p class="post-description">${escapeHtml(post.description)}</p>
          <section class="post-photos">${buildImages(post.images)}</section>
        </div>
      </article>
    `;
  }

  function getGeneratedPostsSorted() {
    return Object.values(getState().generatedPosts).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function renderGeneratedProfilePosts() {
    const container = document.getElementById('generated-profile-posts');
    if (!container) return;

    container.innerHTML = getGeneratedPostsSorted().map(buildProfileGeneratedPostCard).join('');
  }

  function renderGeneratedFundraisers() {
    const container = document.getElementById('generated-fundraiser-posts');
    if (!container) return;

    container.innerHTML = getGeneratedPostsSorted()
      .filter(post => post.type === 'fundraising')
      .map(buildFundraiserCard)
      .join('');
  }

  function renderGeneratedRequestFeed() {
    const container = document.getElementById('generated-request-feed-posts');
    if (!container) return;

    container.innerHTML = getGeneratedPostsSorted()
      .filter(post => post.type === 'request')
      .map(buildRequestFeedCard)
      .join('');
  }

  function renderAcceptedRequests() {
    const list = document.getElementById('accepted-requests-list');
    const empty = document.getElementById('accepted-requests-empty');
    if (!list || !empty) return;

    const acceptedRequests = [
      ...Object.values(getState().acceptedRequests),
      ...Object.values(runtimeState.acceptedRequests),
    ]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (acceptedRequests.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    list.innerHTML = acceptedRequests.map(buildAcceptedRequestCard).join('');
  }

  function collectRequestData(card) {
    return {
      requestId: card.dataset.requestId,
      status: card.dataset.requestStatus || 'open',
      createdAt: Date.now(),
      title: card.querySelector('.post-title')?.textContent.trim() || '',
      description: card.querySelector('.post-description')?.textContent.trim() || '',
      tags: Array.from(card.querySelectorAll('.profile-tag-title')).map(tag => tag.textContent.trim()),
      authorName: card.querySelector('.name')?.textContent.trim() || '',
      authorRole: card.querySelector('.user-role')?.textContent.trim() || '',
      dateText: card.querySelector('.post-date')?.textContent.trim() || '',
      avatar: card.querySelector('.post-profile-pic')?.getAttribute('src') || '/public/images/account-icon.png',
      images: Array.from(card.querySelectorAll('.post-photos img')).map(img => img.getAttribute('src')).filter(Boolean),
    };
  }

  function applyStatusToRequestCards() {
    const state = getState();

    document.querySelectorAll('[data-owned-post-id]').forEach(card => {
      const postId = card.dataset.ownedPostId;
      card.classList.toggle('hidden', Boolean(state.deletedOwnedPosts[postId]));
    });

    document.querySelectorAll('.post[data-request-id]').forEach(card => {
      const requestId = card.dataset.requestId;
      const status = runtimeState.requestStatuses[requestId] || state.requestStatuses[requestId] || card.dataset.requestStatus || 'open';
      const accepted = Boolean(runtimeState.acceptedRequests[requestId] || state.acceptedRequests[requestId]);
      const statusElement = card.querySelector('.request-status');
      const answerButton = card.querySelector('.answer-request-button');
      const closeButton = card.querySelector('.close-request-button');
      const editButton = card.querySelector('.edit-post-button');
      const requestContext = card.dataset.requestContext;
      const isOwnRequest = requestContext === 'author' || requestContext === 'author-feed';

      card.dataset.requestStatus = status;

      if (statusElement) {
        statusElement.textContent = status === 'closed' ? 'Закритий' : 'Відкритий';
        statusElement.classList.toggle('is-open', status !== 'closed');
        statusElement.classList.toggle('is-closed', status === 'closed');
      }

      if (closeButton) {
        closeButton.classList.toggle('hidden', status === 'closed');
      }

      if (editButton && isOwnRequest) {
        editButton.classList.toggle('hidden', status === 'closed');
      }

      if (!answerButton) return;

      if (status === 'closed') {
        answerButton.classList.remove('is-accepted');
        answerButton.disabled = false;
        answerButton.classList.add('hidden');
        return;
      }

      answerButton.classList.remove('hidden');

      const buttonText = answerButton.querySelector('.button-text');
      if (accepted) {
        answerButton.classList.add('is-accepted');
        answerButton.disabled = true;
        if (buttonText) {
          buttonText.textContent = 'Прийнято';
        }
      } else {
        answerButton.classList.remove('is-accepted');
        answerButton.disabled = false;
        if (buttonText) {
          buttonText.textContent = 'Відгукнутись';
        }
      }
    });
  }

  async function ensureReportModal() {
    if (document.getElementById('report-modal')) {
      return;
    }

    const res = await fetch('/public/pages/components/modal-forms/report-form/report-form.html');
    const html = await res.text();
    document.getElementById('modal-container').innerHTML = html;
  }

  function openReportModal(requestId, reportRole) {
    ensureReportModal()
      .then(() => {
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('report-modal');
        const form = document.getElementById('request-report-form');
        const heading = document.getElementById('report-form-heading');
        const textarea = document.getElementById('report-text');
        const preview = document.getElementById('report-image-preview-container');

        if (!overlay || !modal || !form || !heading) return;

        form.reset();
        form.dataset.requestId = requestId;
        form.dataset.reportRole = reportRole;
        heading.textContent = REPORT_TITLES[reportRole] || 'Звіт';
        if (preview) preview.innerHTML = '';

        overlay.classList.remove('hidden');
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open');

        if (textarea) {
          textarea.style.height = 'auto';
        }
      })
      .catch(error => {
        console.error('Не вдалося відкрити форму звіту:', error);
      });
  }

  function syncRequestUI() {
    renderGeneratedProfilePosts();
    renderGeneratedFundraisers();
    renderGeneratedRequestFeed();
    renderAcceptedRequests();
    applyStatusToRequestCards();
  }

  document.addEventListener('DOMContentLoaded', syncRequestUI);
  document.addEventListener('page:loaded', syncRequestUI);

  document.addEventListener('click', (event) => {
    const navLink = event.target.closest('.nav-button a, #open-profile-button');
    if (navLink) {
      setTimeout(syncRequestUI, 40);
    }

    const answerButton = event.target.closest('.answer-request-button');
    if (answerButton && !answerButton.disabled) {
      const card = answerButton.closest('.post[data-request-id]');
      if (!card) return;

      setTimeout(() => {
        const form = document.getElementById('answer-request-form');
        const titleInput = document.getElementById('answer-title');
        const textInput = document.getElementById('answer-text');

        if (!form) return;

        form.dataset.requestId = card.dataset.requestId;
        if (titleInput) {
          titleInput.value = `Відгук на запит: ${card.querySelector('.post-title')?.textContent.trim() || ''}`;
        }
        if (textInput) {
          textInput.value = '';
          textInput.style.height = 'auto';
        }
      }, 80);
    }

    const closeButton = event.target.closest('.close-request-button');
    if (closeButton) {
      const card = closeButton.closest('.post[data-request-id]');
      if (!card) return;

      openReportModal(card.dataset.requestId, closeButton.dataset.reportRole || card.dataset.requestContext || 'author');
    }

    const deleteButton = event.target.closest('.delete-accepted-request-button');
    if (deleteButton) {
      const card = deleteButton.closest('.post[data-request-id]');
      if (!card) return;

      const state = getState();
      delete state.acceptedRequests[card.dataset.requestId];
      delete runtimeState.acceptedRequests[card.dataset.requestId];
      saveState(state);
      syncRequestUI();
    }

    const deleteOwnPostButton = event.target.closest('.delete-own-post-button');
    if (deleteOwnPostButton) {
      const card = deleteOwnPostButton.closest('[data-owned-post-id], .post[data-request-id]');
      if (!card) return;

      const postId = card.dataset.ownedPostId || card.dataset.requestId;
      const state = getState();
      state.deletedOwnedPosts[postId] = true;
      delete state.generatedPosts[postId];
      delete state.requestStatuses[postId];
      delete state.acceptedRequests[postId];
      delete runtimeState.requestStatuses[postId];
      delete runtimeState.acceptedRequests[postId];
      saveState(state);
      syncRequestUI();
    }
  });

  document.addEventListener('submit', (event) => {
    const addPostForm = event.target.closest('#add-post-form');
    if (addPostForm) {
      event.preventDefault();

      const typeSelect = addPostForm.querySelector('select[name="type"]');
      const titleInput = addPostForm.querySelector('input[name="post-title"]');
      const descriptionInput = addPostForm.querySelector('textarea[name="post-text"]');
      const tagTitles = Array.from(addPostForm.querySelectorAll('.post-tag-title')).map(tag => tag.textContent.trim());
      const previewImages = Array.from(addPostForm.querySelectorAll('.image-container .added-image')).map(image => image.getAttribute('src')).filter(Boolean);

      const selectedType = typeSelect?.value || 'fundraising';
      const createdAt = Date.now();
      const postId = `generated-${selectedType}-${createdAt}`;
      const state = getState();

      state.generatedPosts[postId] = {
        postId,
        type: selectedType,
        status: selectedType === 'request' ? 'open' : undefined,
        createdAt,
        title: titleInput?.value.trim() || (selectedType === 'request' ? 'Новий запит' : 'Новий збір'),
        description: descriptionInput?.value.trim() || 'Опис буде додано пізніше.',
        tags: tagTitles,
        avatar: '/public/images/premium_photo-1689568126014-06fea9d5d341.jpg',
        images: previewImages,
        dateText: 'щойно',
      };

      if (selectedType === 'request') {
        state.requestStatuses[postId] = 'open';
      }

      saveState(state);

      syncRequestUI();
      document.getElementById('modal-overlay')?.classList.add('hidden');
      document.getElementById('post-modal')?.classList.add('hidden');
      document.body.classList.remove('modal-open');
      addPostForm.reset();

      const preview = document.getElementById('post-image-preview-container');
      const tags = document.getElementById('user-post-tags');
      if (preview) preview.innerHTML = '';
      if (tags) tags.innerHTML = '';
      return;
    }

    const answerForm = event.target.closest('#answer-request-form');
    if (answerForm) {
      event.preventDefault();

      const requestId = answerForm.dataset.requestId;
      const sourceCard = document.querySelector(`.post[data-request-id="${requestId}"]`);
      if (!requestId || !sourceCard) return;

      const requestData = collectRequestData(sourceCard);
      requestData.createdAt = Date.now();

      if (isDemoRequestId(requestId)) {
        runtimeState.acceptedRequests[requestId] = requestData;
      } else {
        const state = getState();
        state.acceptedRequests[requestId] = requestData;
        saveState(state);
      }
      syncRequestUI();

      document.getElementById('modal-overlay')?.classList.add('hidden');
      document.getElementById('answer-request-modal')?.classList.add('hidden');
      document.body.classList.remove('modal-open');
      return;
    }

    const reportForm = event.target.closest('#request-report-form');
    if (reportForm) {
      event.preventDefault();

      const requestId = reportForm.dataset.requestId;
      if (!requestId) return;

      if (isDemoRequestId(requestId)) {
        runtimeState.requestStatuses[requestId] = 'closed';
        if (runtimeState.acceptedRequests[requestId]) {
          runtimeState.acceptedRequests[requestId].status = 'closed';
        }
      } else {
        const state = getState();
        state.requestStatuses[requestId] = 'closed';
        if (state.acceptedRequests[requestId]) {
          state.acceptedRequests[requestId].status = 'closed';
        }
        saveState(state);
      }
      syncRequestUI();

      document.getElementById('modal-overlay')?.classList.add('hidden');
      document.getElementById('report-modal')?.classList.add('hidden');
      document.body.classList.remove('modal-open');
    }
  });
})();
