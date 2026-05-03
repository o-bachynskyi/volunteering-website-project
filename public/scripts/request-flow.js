(function () {
  const STORAGE_KEY = 'mock-request-flow-state';
  const STATE_VERSION = 4;
  const REPORT_TITLES = {
    author: 'Звіт про отримання допомоги',
    helper: 'Звіт про надання допомоги',
  };
  const DEMO_REQUEST_IDS = ['request-generator', 'request-medkits'];
  const runtimeState = {
    requestStatuses: {},
    acceptedRequests: {},
    reports: {},
  };
  let activeReportContext = null;

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
    reports: {},
  };

  function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
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
      reports: Object.fromEntries(
        Object.entries(parsed.reports || {}).filter(([, report]) => !isDemoRequestId(report?.requestId))
      ),
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
          acceptedRequests: sanitized.acceptedRequests,
          reports: sanitized.reports,
        };
      }

      return {
        version: STATE_VERSION,
        requestStatuses: { ...defaultState.requestStatuses, ...sanitized.requestStatuses },
        generatedPosts: { ...defaultState.generatedPosts, ...sanitized.generatedPosts },
        deletedOwnedPosts: { ...defaultState.deletedOwnedPosts, ...sanitized.deletedOwnedPosts },
        acceptedRequests: { ...defaultState.acceptedRequests, ...sanitized.acceptedRequests },
        reports: { ...defaultState.reports, ...sanitized.reports },
      };
    } catch (error) {
      console.error('Помилка читання mock request state:', error);
      return cloneState(defaultState);
    }
  }

  function saveState(state) {
    const reports = Object.fromEntries(
      Object.entries(state.reports || {}).filter(([, report]) => !isDemoRequestId(report?.requestId))
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STATE_VERSION,
      requestStatuses: stripDemoRequestState(state.requestStatuses),
      generatedPosts: state.generatedPosts,
      deletedOwnedPosts: state.deletedOwnedPosts,
      acceptedRequests: stripDemoRequestState(state.acceptedRequests),
      reports,
    }));
  }

  function formatDateTime(value) {
    if (!value) return 'Невідомо';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function formatDateTextForCard(timestamp) {
    if (!timestamp) return 'щойно';
    const diff = Date.now() - timestamp;
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    if (diff < oneHour) return 'щойно';
    if (diff < oneDay) return `${Math.max(1, Math.floor(diff / oneHour))} год.`;
    return `${Math.max(1, Math.floor(diff / oneDay))} дн.`;
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

  function getAcceptedRequestCollections(requestId, state) {
    if (isDemoRequestId(requestId)) {
      return { primary: runtimeState.acceptedRequests, secondary: null, persist: false };
    }

    return { primary: state.acceptedRequests, secondary: runtimeState.acceptedRequests, persist: true };
  }

  function getReportCollections(requestId, state) {
    if (isDemoRequestId(requestId)) {
      return { primary: runtimeState.reports, persist: false };
    }

    return { primary: state.reports, persist: true };
  }

  function getOverallRequestStatus(requestId, state) {
    return runtimeState.requestStatuses[requestId]
      || state.requestStatuses[requestId]
      || defaultState.requestStatuses[requestId]
      || 'open';
  }

  function getAcceptedRequestStatus(requestId, state) {
    return runtimeState.acceptedRequests[requestId]?.status
      || state.acceptedRequests[requestId]?.status
      || 'open';
  }

  function collectRequestData(card) {
    return {
      requestId: card.dataset.requestId,
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
                <time class="post-date">${escapeHtml(request.acceptedDateText || request.dateText)}</time>
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

  function buildReportCard(report) {
    const requestTitle = report.requestSnapshot?.title || 'Без назви запиту';
    const requestStatus = report.reporterRole === 'author' ? 'Запит закрито автором' : 'Звіт подано виконавцем';

    return `
      <article class="report-record-card" data-report-id="${escapeHtml(report.reportId)}">
        <div class="report-record-main">
          <div class="report-record-copy">
            <p class="report-record-type">${escapeHtml(report.reportTitle)}</p>
            <h3 class="report-record-title">${escapeHtml(requestTitle)}</h3>
            <p class="report-record-meta">Створено: ${escapeHtml(formatDateTime(report.createdAt))}</p>
            <p class="report-record-meta">${escapeHtml(requestStatus)}</p>
          </div>
            <div class="report-record-actions">
              <button type="button" class="report-action-button view-report-button" data-report-id="${escapeHtml(report.reportId)}">
                Переглянути
              </button>
              <button type="button" class="report-action-button export-report-button" data-report-id="${escapeHtml(report.reportId)}">
                Експортувати
              </button>
            </div>
        </div>
      </article>
    `;
  }

  function getGeneratedPostsSorted() {
    return Object.values(getState().generatedPosts).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function getReportsSorted() {
    const state = getState();
    return [
      ...Object.values(state.reports),
      ...Object.values(runtimeState.reports),
    ].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function renderGeneratedProfilePosts() {
    const container = document.getElementById('generated-profile-posts');
    if (!container) return;

    const state = getState();
    container.innerHTML = getGeneratedPostsSorted()
      .map(post => {
        if (post.type === 'request') {
          return buildProfileGeneratedPostCard({
            ...post,
            status: getOverallRequestStatus(post.postId, state),
          });
        }
        return buildProfileGeneratedPostCard(post);
      })
      .join('');
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

    const state = getState();
    container.innerHTML = getGeneratedPostsSorted()
      .filter(post => post.type === 'request')
      .map(post => buildRequestFeedCard({
        ...post,
        status: getOverallRequestStatus(post.postId, state),
      }))
      .join('');
  }

  function renderAcceptedRequests() {
    const list = document.getElementById('accepted-requests-list');
    const empty = document.getElementById('accepted-requests-empty');
    if (!list || !empty) return;

    const state = getState();
    const acceptedRequests = [
      ...Object.values(state.acceptedRequests),
      ...Object.values(runtimeState.acceptedRequests),
    ].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (acceptedRequests.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    list.innerHTML = acceptedRequests
      .map(request => buildAcceptedRequestCard({
        ...request,
        status: getAcceptedRequestStatus(request.requestId, state),
      }))
      .join('');
  }

  function renderReports() {
    const list = document.getElementById('reports-list');
    const empty = document.getElementById('reports-empty');
    if (!list || !empty) return;

    const reports = getReportsSorted();
    if (!reports.length) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    list.innerHTML = reports.map(buildReportCard).join('');
  }

  function applyStatusToRequestCards() {
    const state = getState();

    document.querySelectorAll('[data-owned-post-id]').forEach(card => {
      const postId = card.dataset.ownedPostId;
      card.classList.toggle('hidden', Boolean(state.deletedOwnedPosts[postId]));
    });

    document.querySelectorAll('.post[data-request-id]').forEach(card => {
      const requestId = card.dataset.requestId;
      const requestContext = card.dataset.requestContext;
      const isOwnRequest = requestContext === 'author' || requestContext === 'author-feed';
      const status = requestContext === 'helper'
        ? getAcceptedRequestStatus(requestId, state)
        : getOverallRequestStatus(requestId, state);
      const accepted = Boolean(runtimeState.acceptedRequests[requestId] || state.acceptedRequests[requestId]);
      const statusElement = card.querySelector('.request-status');
      const answerButton = card.querySelector('.answer-request-button');
      const closeButton = card.querySelector('.close-request-button');
      const editButton = card.querySelector('.edit-post-button');

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
        if (buttonText) buttonText.textContent = 'Прийнято';
      } else {
        answerButton.classList.remove('is-accepted');
        answerButton.disabled = false;
        if (buttonText) buttonText.textContent = 'Відгукнутись';
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

  function ensureReportPreviewModal() {
    let overlay = document.getElementById('report-preview-overlay');
    let modal = document.getElementById('report-preview-modal');

    if (overlay && modal) {
      return { overlay, modal };
    }

    overlay = document.createElement('div');
    overlay.id = 'report-preview-overlay';
    overlay.className = 'modal-overlay hidden report-preview-overlay';

    modal = document.createElement('div');
    modal.id = 'report-preview-modal';
    modal.className = 'report-preview-modal-window hidden';
    modal.innerHTML = `
      <div class="report-preview-scroll">
        <div class="report-preview-actions">
          <button type="button" class="report-action-button export-report-button" id="preview-export-report-button">Експортувати</button>
          <button type="button" class="close-preview-button" id="close-report-preview-button" aria-label="Закрити звіт">
            <img src="/public/images/close-modal-icon.png" alt="Close report">
          </button>
        </div>
        <div class="report-preview-document" id="report-preview-document"></div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    const closePreview = () => {
      overlay.classList.add('hidden');
      modal.classList.add('hidden');
      document.body.classList.remove('modal-open');
    };

    overlay.addEventListener('click', closePreview);
    modal.querySelector('#close-report-preview-button')?.addEventListener('click', closePreview);

    return { overlay, modal };
  }

  function openReportModal(card, reportRole) {
    const requestData = collectRequestData(card);

    ensureReportModal()
      .then(() => {
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('report-modal');
        const form = document.getElementById('request-report-form');
        const heading = document.getElementById('report-form-heading');
        const textarea = document.getElementById('report-text');
        const preview = document.getElementById('report-image-preview-container');

        if (!overlay || !modal || !form || !heading) return;

        activeReportContext = {
          requestId: card.dataset.requestId,
          reportRole,
          requestData,
        };

        form.reset();
        form.dataset.requestId = card.dataset.requestId;
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

  function buildReportMarkup(report) {
    const request = report.requestSnapshot || {};
    const requestImageMarkup = request.images?.length
      ? request.images.map((imageUrl, index) => `
          <figure class="report-document-image">
            <img src="${escapeHtml(imageUrl)}" alt="Request image ${index + 1}">
          </figure>
        `).join('')
      : '<p class="report-document-empty">У запиті не було доданих фото.</p>';
    const reportImageMarkup = report.images?.length
      ? report.images.map((imageUrl, index) => `
          <figure class="report-document-image">
            <img src="${escapeHtml(imageUrl)}" alt="Report image ${index + 1}">
          </figure>
        `).join('')
      : '<p class="report-document-empty">Фото до звіту не додано.</p>';

    const tagsMarkup = request.tags?.length
      ? request.tags.map(tag => `<span class="report-document-tag">${escapeHtml(tag)}</span>`).join('')
      : '<span class="report-document-tag muted">Без тегів</span>';

    return `
      <div class="report-document-sheet">
        <header class="report-document-header">
          <p class="report-document-kicker">Офіційний звіт</p>
          <h2 class="report-document-title">${escapeHtml(report.reportTitle)}</h2>
          <div class="report-document-meta-grid">
            <div>
              <p class="report-document-meta-label">Номер звіту</p>
              <p class="report-document-meta-value">${escapeHtml(report.reportId)}</p>
            </div>
            <div>
              <p class="report-document-meta-label">Дата створення</p>
              <p class="report-document-meta-value">${escapeHtml(formatDateTime(report.createdAt))}</p>
            </div>
            <div>
                <p class="report-document-meta-label">Роль автора звіту</p>
                <p class="report-document-meta-value">${escapeHtml(report.reporterUserRole || (report.reporterRole === 'author' ? 'Військовий' : 'Волонтер'))}</p>
              </div>
            </div>
          </header>
        <section class="report-document-section">
          <h3>Інформація про запит</h3>
          <div class="report-document-request">
            <p class="report-document-request-title">${escapeHtml(request.title || 'Без назви')}</p>
            <p class="report-document-request-meta">Автор: ${escapeHtml(request.authorName || 'Невідомо')} (${escapeHtml(request.authorRole || 'Невідомо')})</p>
            <p class="report-document-request-meta">Дата запиту: ${escapeHtml(request.dateText || 'Невідомо')}</p>
            <div class="report-document-tags">${tagsMarkup}</div>
            <p class="report-document-text">${escapeHtml(request.description || 'Опис запиту відсутній.')}</p>
            <div class="report-document-subsection">
              <h4>Фото із запиту</h4>
              <div class="report-document-images">${requestImageMarkup}</div>
            </div>
          </div>
        </section>
        <section class="report-document-section">
          <h3>Текст звіту</h3>
          <p class="report-document-text">${escapeHtml(report.text || 'Текст звіту відсутній.')}</p>
        </section>
        <section class="report-document-section">
          <h3>Додані фото</h3>
          <div class="report-document-images">${reportImageMarkup}</div>
        </section>
      </div>
    `;
  }

  function buildReportExportDocument(report) {
    return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(report.reportTitle)}</title>
  <style>
    body {
      margin: 0;
      padding: 32px;
      font-family: Arial, sans-serif;
      color: #1c1c1c;
      background: #ffffff;
    }
    .report-document-sheet {
      max-width: 900px;
      margin: 0 auto;
      border: 1px solid #d6d6d6;
      border-radius: 18px;
      padding: 28px;
    }
    .report-document-kicker {
      margin: 0 0 8px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #666666;
    }
    .report-document-title {
      margin: 0 0 20px;
      font-size: 30px;
    }
    .report-document-meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }
    .report-document-meta-label {
      margin: 0 0 4px;
      font-size: 12px;
      color: #666666;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .report-document-meta-value,
    .report-document-request-title,
    .report-document-request-meta,
    .report-document-text {
      margin: 0;
    }
    .report-document-section {
      margin-top: 24px;
    }
    .report-document-section h3 {
      margin: 0 0 12px;
      font-size: 20px;
    }
    .report-document-request {
      padding: 18px;
      background: #f6f6f6;
      border-radius: 14px;
    }
    .report-document-request-title {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .report-document-request-meta {
      margin-bottom: 6px;
      color: #4f4f4f;
    }
    .report-document-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 12px 0;
    }
    .report-document-tag {
      display: inline-flex;
      align-items: center;
      padding: 6px 12px;
      background: #d9d9d9;
      border-radius: 999px;
      font-size: 13px;
    }
    .report-document-tag.muted {
      color: #666666;
    }
    .report-document-text {
      white-space: pre-wrap;
      line-height: 1.6;
      word-break: break-word;
    }
    .report-document-subsection {
      margin-top: 16px;
    }
    .report-document-subsection h4 {
      margin: 0 0 10px;
      font-size: 16px;
    }
    .report-document-images {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .report-document-image {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      overflow: hidden;
      border-radius: 14px;
      border: 1px solid #d8d8d8;
      width: 243px;
      height: 243px;
      flex: 0 0 243px;
      background: #f3f3f3;
      padding: 10px;
    }
    .report-document-image img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .report-document-empty {
      color: #666666;
    }
  </style>
</head>
<body>
  ${buildReportMarkup(report)}
  <script>
    window.addEventListener('load', function () {
      window.print();
    });
  </script>
</body>
</html>`;
  }

  function openReportPreview(reportId) {
    const report = getReportsSorted().find(entry => entry.reportId === reportId);
    if (!report) return;

    const { overlay, modal } = ensureReportPreviewModal();
    const documentContainer = modal.querySelector('#report-preview-document');
    const exportButton = modal.querySelector('#preview-export-report-button');

    if (!documentContainer || !exportButton) return;

    documentContainer.innerHTML = buildReportMarkup(report);
    exportButton.dataset.reportId = reportId;

    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function exportReport(reportId) {
    const report = getReportsSorted().find(entry => entry.reportId === reportId);
    if (!report) return;

    const reportWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!reportWindow) return;

    reportWindow.document.write(buildReportExportDocument(report));
    reportWindow.document.close();
  }

  function syncRequestUI() {
    renderGeneratedProfilePosts();
    renderGeneratedFundraisers();
    renderGeneratedRequestFeed();
    renderAcceptedRequests();
    renderReports();
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

      openReportModal(card, closeButton.dataset.reportRole || card.dataset.requestContext || 'author');
    }

    const deleteButton = event.target.closest('.delete-accepted-request-button');
    if (deleteButton) {
      const card = deleteButton.closest('.post[data-request-id]');
      if (!card) return;

      const requestId = card.dataset.requestId;
      const state = getState();
      delete state.acceptedRequests[requestId];
      delete runtimeState.acceptedRequests[requestId];
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

    const viewReportButton = event.target.closest('.view-report-button');
    if (viewReportButton) {
      openReportPreview(viewReportButton.dataset.reportId);
    }

    const exportReportButton = event.target.closest('.export-report-button');
    if (exportReportButton) {
      exportReport(exportReportButton.dataset.reportId);
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
      const acceptedRequest = {
        ...requestData,
        requestId,
        createdAt: Date.now(),
        acceptedAt: Date.now(),
        acceptedDateText: formatDateTextForCard(Date.now()),
        status: 'open',
      };

      if (isDemoRequestId(requestId)) {
        runtimeState.acceptedRequests[requestId] = acceptedRequest;
      } else {
        const state = getState();
        state.acceptedRequests[requestId] = acceptedRequest;
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

      const requestId = activeReportContext?.requestId || reportForm.dataset.requestId;
      const reportRole = activeReportContext?.reportRole || reportForm.dataset.reportRole;
      const reportText = reportForm.querySelector('#report-text')?.value.trim() || '';
      const reportImages = Array.from(reportForm.querySelectorAll('.image-container .added-image'))
        .map(image => image.getAttribute('src'))
        .filter(Boolean);

      if (!requestId || !reportRole) return;

      const state = getState();
      const reportId = `report-${requestId}-${Date.now()}`;
      const report = {
        reportId,
        requestId,
        reporterRole: reportRole,
        reporterUserRole: window.AuthState?.getUser()?.role_name || (reportRole === 'author' ? 'Військовий' : 'Волонтер'),
        reportTitle: REPORT_TITLES[reportRole] || 'Звіт',
        text: reportText,
        images: reportImages,
        createdAt: Date.now(),
        requestSnapshot: activeReportContext?.requestData || {},
      };

      const reportCollections = getReportCollections(requestId, state);
      reportCollections.primary[reportId] = report;

      if (reportRole === 'author') {
        if (isDemoRequestId(requestId)) {
          runtimeState.requestStatuses[requestId] = 'closed';
          if (runtimeState.acceptedRequests[requestId]) {
            runtimeState.acceptedRequests[requestId].status = 'closed';
          }
        } else {
          state.requestStatuses[requestId] = 'closed';
          if (state.acceptedRequests[requestId]) {
            state.acceptedRequests[requestId].status = 'closed';
          }
          if (runtimeState.acceptedRequests[requestId]) {
            runtimeState.acceptedRequests[requestId].status = 'closed';
          }
        }
      } else {
        const acceptedCollections = getAcceptedRequestCollections(requestId, state);
        if (acceptedCollections.primary[requestId]) {
          acceptedCollections.primary[requestId].status = 'closed';
        }
      }

      if (reportCollections.persist) {
        saveState(state);
      }

      syncRequestUI();
      document.getElementById('modal-overlay')?.classList.add('hidden');
      document.getElementById('report-modal')?.classList.add('hidden');
      document.body.classList.remove('modal-open');
      activeReportContext = null;
    }
  });
})();
