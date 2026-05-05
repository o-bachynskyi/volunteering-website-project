(function () {
  const REPORT_TITLES = {
    author: 'Звіт про отримання допомоги',
    helper: 'Звіт про надання допомоги',
  };
  const runtimeState = {
    deletedOwnedPosts: {},
  };
  const apiState = {
    posts: [],
    responses: [],
    reports: [],
    loading: null,
    responseLoading: null,
    reportLoading: null,
  };
  let activeReportContext = null;

  function escapeHtml(text = '') {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function getCurrentUserId() {
    return window.AuthState?.getUser()?.rnokpp || null;
  }

  function isLoggedIn() {
    return Boolean(window.AuthState?.isLoggedIn());
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

    return tags.map((tag) => `
      <div class="profile-tag">
        <p class="profile-tag-title">${escapeHtml(tag)}</p>
      </div>
    `).join('');
  }

  function buildImages(images = []) {
    return images.map((imageUrl) => `
      <img src="${escapeHtml(imageUrl)}" alt="post photo" class="photo">
    `).join('');
  }

  async function loadPostsFromServer() {
    if (apiState.loading) {
      return apiState.loading;
    }

    apiState.loading = (async () => {
      try {
        const response = await fetch('/posts', { credentials: 'same-origin' });
        if (!response.ok) {
          throw new Error(`Не вдалося завантажити дописи: ${response.status}`);
        }

        const result = await response.json();
        apiState.posts = Array.isArray(result.posts) ? result.posts : [];
      } catch (error) {
        console.error('Помилка завантаження дописів:', error);
        apiState.posts = [];
      } finally {
        apiState.loading = null;
      }

      return apiState.posts;
    })();

    return apiState.loading;
  }

  async function loadResponsesFromServer() {
    if (!isLoggedIn()) {
      apiState.responses = [];
      return apiState.responses;
    }

    if (apiState.responseLoading) {
      return apiState.responseLoading;
    }

    apiState.responseLoading = (async () => {
      try {
        const response = await fetch('/responses/mine', { credentials: 'same-origin' });
        if (!response.ok) {
          throw new Error(`Не вдалося завантажити відгуки: ${response.status}`);
        }

        const result = await response.json();
        apiState.responses = Array.isArray(result.acceptedRequests) ? result.acceptedRequests : [];
      } catch (error) {
        console.error('Помилка завантаження прийнятих запитів:', error);
        apiState.responses = [];
      } finally {
        apiState.responseLoading = null;
      }

      return apiState.responses;
    })();

    return apiState.responseLoading;
  }

  async function loadReportsFromServer() {
    if (!isLoggedIn()) {
      apiState.reports = [];
      return apiState.reports;
    }

    if (apiState.reportLoading) {
      return apiState.reportLoading;
    }

    apiState.reportLoading = (async () => {
      try {
        const response = await fetch('/reports/mine', { credentials: 'same-origin' });
        if (!response.ok) {
          throw new Error(`Не вдалося завантажити звіти: ${response.status}`);
        }

        const result = await response.json();
        apiState.reports = Array.isArray(result.reports) ? result.reports : [];
      } catch (error) {
        console.error('Помилка завантаження звітів:', error);
        apiState.reports = [];
      } finally {
        apiState.reportLoading = null;
      }

      return apiState.reports;
    })();

    return apiState.reportLoading;
  }

  function collectRequestData(card) {
    return {
      requestId: card.dataset.requestId || '',
      title: card.querySelector('.post-title')?.textContent.trim() || '',
      description: card.querySelector('.post-description')?.textContent.trim() || '',
      tags: Array.from(card.querySelectorAll('.profile-tag-title')).map((tag) => tag.textContent.trim()),
      authorName: card.querySelector('.name')?.textContent.trim() || '',
      authorRole: card.querySelector('.user-role')?.textContent.trim() || '',
      dateText: card.querySelector('.post-date')?.textContent.trim() || '',
      avatar: card.querySelector('.post-profile-pic')?.getAttribute('src') || '/public/images/account-icon.png',
      images: Array.from(card.querySelectorAll('.post-photos img')).map((img) => img.getAttribute('src')).filter(Boolean),
    };
  }

  function getAllPostsSorted() {
    return [...apiState.posts]
      .map((post) => ({
        ...post,
        dateText: post.dateText || formatDateTextForCard(post.createdAt),
      }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function getOwnedPostsSorted() {
    const currentUserId = getCurrentUserId();
    return getAllPostsSorted().filter((post) => currentUserId && post.authorId === currentUserId);
  }

  function getReportsSorted() {
    return [...apiState.reports].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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
      <article class="post request-post-card" data-request-id="${escapeHtml(request.requestId)}" data-response-id="${escapeHtml(request.responseId || '')}" data-request-status="${escapeHtml(request.status)}" data-request-context="helper">
        <header class="post-header request-post-header">
          <div class="request-post-header-left">
            <img src="${escapeHtml(request.avatar)}" alt="User Profile Picture" class="post-profile-pic">
            <div class="post-data">
              <div class="user-info">
                <p class="name">${escapeHtml(request.authorName)}</p>
                <p class="dot">•</p>
                <time class="post-date">${escapeHtml(request.acceptedDateText || formatDateTextForCard(request.createdAt))}</time>
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

  function buildPublicRequestCard(request) {
    const isClosed = request.status === 'closed';

    return `
      <article class="post request-post-card" data-request-id="${escapeHtml(request.postId)}" data-request-status="${escapeHtml(request.status)}" data-request-context="request-feed">
        <header class="request-post-header">
          <div class="request-post-header-left">
            <img src="${escapeHtml(request.avatar)}" alt="User Profile Picture" class="post-profile-pic">
            <div class="post-data">
              <div class="user-info">
                <p class="name">${escapeHtml(request.authorName || 'Користувач')}</p>
                <p class="dot">•</p>
                <time class="post-date">${escapeHtml(request.dateText)}</time>
              </div>
              <p class="user-role">${escapeHtml(request.authorRole || 'Користувач')}</p>
              <p class="request-status ${isClosed ? 'is-closed' : 'is-open'}">${isClosed ? 'Закритий' : 'Відкритий'}</p>
            </div>
          </div>
          <button class="answer-request-button" aria-label="Відгукнутись">
            <span class="button-text">Відгукнутись</span>
            <img class="button-icon" src="/public/images/answer-icon.png" alt="Відгук icon">
          </button>
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
    const isOwnRequest = request.isOwnPost || request.authorId === getCurrentUserId();
    if (!isOwnRequest) {
      return buildPublicRequestCard(request);
    }

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
                <p class="name">${escapeHtml(request.authorName || 'Користувач')}</p>
                <p class="dot">•</p>
                <time class="post-date">${escapeHtml(request.dateText)}</time>
              </div>
              <p class="user-role">${escapeHtml(request.authorRole || 'Користувач')}</p>
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
              <p class="name">${escapeHtml(post.authorName || 'Користувач')}</p>
              <p class="dot">•</p>
              <time class="post-date">${escapeHtml(post.dateText)}</time>
            </div>
            <p class="user-role">${escapeHtml(post.authorRole || 'Користувач')}</p>
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
    const ownerActions = post.isOwnPost ? `
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
    ` : '';

    return `
      <article class="post" data-owned-post-id="${escapeHtml(post.isOwnPost ? post.postId : '')}">
        <header class="post-header">
          <img src="${escapeHtml(post.avatar)}" alt="User Profile Picture" class="post-profile-pic">
          <div class="post-data">
            <div class="user-info">
              <p class="name">${escapeHtml(post.authorName || 'Користувач')}</p>
              <p class="dot">•</p>
              <time class="post-date">${escapeHtml(post.dateText)}</time>
            </div>
            <p class="user-role">${escapeHtml(post.authorRole || 'Користувач')}</p>
            ${ownerActions}
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
    const requestTitle = report.requestSnapshot?.title || 'Без назви';
    const requestStatus = report.reporterRole === 'author'
      ? 'Запит закрито автором'
      : 'Відгук закрито волонтером';

    return `
      <article class="report-record-card">
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

  function renderGeneratedProfilePosts() {
    const container = document.getElementById('generated-profile-posts');
    if (!container) return;

    container.innerHTML = getOwnedPostsSorted()
      .map((post) => buildProfileGeneratedPostCard({
        ...post,
        status: post.status,
      }))
      .join('');
  }

  function renderGeneratedFundraisers() {
    const container = document.getElementById('generated-fundraiser-posts');
    if (!container) return;

    container.innerHTML = getAllPostsSorted()
      .filter((post) => post.type === 'fundraising')
      .map(buildFundraiserCard)
      .join('');
  }

  function renderGeneratedRequestFeed() {
    const container = document.getElementById('generated-request-feed-posts');
    if (!container) return;

    container.innerHTML = getAllPostsSorted()
      .filter((post) => post.type === 'request')
      .map((post) => buildRequestFeedCard(post))
      .join('');
  }

  function renderAcceptedRequests() {
    const list = document.getElementById('accepted-requests-list');
    const empty = document.getElementById('accepted-requests-empty');
    if (!list || !empty) return;

    const acceptedRequests = [...apiState.responses].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (!acceptedRequests.length) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    list.innerHTML = acceptedRequests
      .map((request) => buildAcceptedRequestCard(request))
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
    document.querySelectorAll('[data-owned-post-id]').forEach((card) => {
      const postId = card.dataset.ownedPostId;
      if (!postId) return;
      card.classList.toggle('hidden', Boolean(runtimeState.deletedOwnedPosts[postId]));
    });

    document.querySelectorAll('.post[data-request-id]').forEach((card) => {
      const requestId = card.dataset.requestId;
      const requestContext = card.dataset.requestContext;
      const isOwnRequest = requestContext === 'author' || requestContext === 'author-feed';
      const apiResponse = apiState.responses.find((entry) => entry.requestId === String(requestId));
      const status = requestContext === 'helper'
        ? (apiResponse?.status || 'open')
        : (card.dataset.requestStatus || 'open');
      const accepted = Boolean(apiResponse);
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
        answerButton.classList.add('hidden');
        answerButton.disabled = false;
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
          responseId: card.dataset.responseId || '',
          reportRole,
          requestData,
        };

        form.reset();
        form.dataset.requestId = card.dataset.requestId;
        form.dataset.responseId = card.dataset.responseId || '';
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
      .catch((error) => {
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
      ? request.tags.map((tag) => `<span class="report-document-tag">${escapeHtml(tag)}</span>`).join('')
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
    body { margin: 0; padding: 32px; font-family: Arial, sans-serif; color: #1c1c1c; background: #ffffff; }
    .report-document-sheet { max-width: 900px; margin: 0 auto; border: 1px solid #d6d6d6; border-radius: 18px; padding: 28px; }
    .report-document-kicker { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #666666; }
    .report-document-title { margin: 0 0 20px; font-size: 30px; }
    .report-document-meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 24px; }
    .report-document-meta-label { margin: 0 0 4px; font-size: 12px; color: #666666; text-transform: uppercase; letter-spacing: 0.08em; }
    .report-document-meta-value, .report-document-request-title, .report-document-request-meta, .report-document-text { margin: 0; }
    .report-document-section { margin-top: 24px; }
    .report-document-section h3 { margin: 0 0 12px; font-size: 20px; }
    .report-document-request { padding: 18px; background: #f6f6f6; border-radius: 14px; }
    .report-document-request-title { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    .report-document-request-meta { margin-bottom: 6px; color: #4f4f4f; }
    .report-document-tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .report-document-tag { display: inline-flex; align-items: center; padding: 6px 12px; background: #d9d9d9; border-radius: 999px; font-size: 13px; }
    .report-document-tag.muted { color: #666666; }
    .report-document-text { white-space: pre-wrap; line-height: 1.6; word-break: break-word; }
    .report-document-subsection { margin-top: 16px; }
    .report-document-subsection h4 { margin: 0 0 10px; font-size: 16px; }
    .report-document-images { display: flex; flex-wrap: wrap; gap: 12px; }
    .report-document-image { display: flex; align-items: center; justify-content: center; margin: 0; overflow: hidden; border-radius: 14px; border: 1px solid #d8d8d8; width: 243px; height: 243px; flex: 0 0 243px; background: #f3f3f3; padding: 10px; }
    .report-document-image img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .report-document-empty { color: #666666; }
  </style>
</head>
<body>
  ${buildReportMarkup(report)}
  <script>window.addEventListener('load', function () { window.print(); });</script>
</body>
</html>`;
  }

  function openReportPreview(reportId) {
    const report = getReportsSorted().find((entry) => entry.reportId === reportId);
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
    const report = getReportsSorted().find((entry) => entry.reportId === reportId);
    if (!report) return;

    const reportWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!reportWindow) return;

    reportWindow.document.write(buildReportExportDocument(report));
    reportWindow.document.close();
  }

  function closeSharedModal(modalId) {
    document.getElementById('modal-overlay')?.classList.add('hidden');
    document.getElementById(modalId)?.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  function clearImageContainer(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }
  }

  function readImagesFromForm(form) {
    return Array.from(form.querySelectorAll('.image-container .added-image'))
      .map((image) => image.getAttribute('src'))
      .filter(Boolean);
  }

  function readTagsFromContainer(container) {
    return Array.from(container?.querySelectorAll('.post-tag-title, .profile-tag-title') || [])
      .map((tag) => tag.textContent.trim())
      .filter(Boolean);
  }

  function upsertPendingProfileTag(form) {
    const input = form.querySelector('#profile-tags');
    const tagsContainer = form.querySelector('#user-profile-tags');
    const value = input?.value.trim();
    if (!input || !tagsContainer || !value) return;

    const duplicate = Array.from(tagsContainer.querySelectorAll('.profile-tag-title'))
      .some((tag) => tag.textContent.trim().toLowerCase() === value.toLowerCase());
    if (duplicate) {
      input.value = '';
      return;
    }

    tagsContainer.insertAdjacentHTML('beforeend', `
      <div class="profile-tag">
        <p class="profile-tag-title">${escapeHtml(value)}</p>
        <button type="button" class="close">
          <img src="/public/images/close-icon.png" alt="Видалити тег">
        </button>
      </div>
    `);
    input.value = '';
  }

  function updateStaticPostCard(postId, data) {
    document.querySelectorAll(`[data-owned-post-id="${postId}"], .post[data-request-id="${postId}"]`).forEach((card) => {
      const typeSelectStatus = data.type === 'request';
      if (card.dataset.requestId !== undefined && !typeSelectStatus) {
        delete card.dataset.requestId;
        delete card.dataset.requestStatus;
      }

      if (typeSelectStatus) {
        card.dataset.requestId = postId;
        card.dataset.requestStatus = 'open';
      }

      const title = card.querySelector('.post-title');
      const description = card.querySelector('.post-description');
      const tagsContainer = card.querySelector('.profile-tags');
      const photos = card.querySelector('.post-photos');
      const statusElement = card.querySelector('.request-status');

      if (title) title.textContent = data.title;
      if (description) description.textContent = data.description;
      if (tagsContainer) tagsContainer.innerHTML = buildTags(data.tags);
      if (photos) photos.innerHTML = buildImages(data.images);

      if (statusElement && typeSelectStatus) {
        const status = 'open';
        statusElement.textContent = status === 'closed' ? 'Закритий' : 'Відкритий';
        statusElement.classList.toggle('is-open', status !== 'closed');
        statusElement.classList.toggle('is-closed', status === 'closed');
      }
    });
  }

  async function syncRequestUI() {
    await Promise.all([
      loadPostsFromServer(),
      loadResponsesFromServer(),
      loadReportsFromServer(),
    ]);

    renderGeneratedProfilePosts();
    renderGeneratedFundraisers();
    renderGeneratedRequestFeed();
    renderAcceptedRequests();
    renderReports();
    applyStatusToRequestCards();
  }

  document.addEventListener('DOMContentLoaded', () => {
    void syncRequestUI();
  });
  document.addEventListener('page:loaded', () => {
    void syncRequestUI();
  });
  document.addEventListener('auth:changed', () => {
    void syncRequestUI();
  });

  document.addEventListener('click', (event) => {
    const navLink = event.target.closest('.nav-button a, #open-profile-button');
    if (navLink) {
      setTimeout(() => {
        void syncRequestUI();
      }, 40);
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
      const responseId = card.dataset.responseId;

      if (/^\d+$/.test(String(responseId))) {
        fetch(`/responses/${responseId}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        })
          .then(async (response) => {
            if (!response.ok) {
              const result = await response.json().catch(() => ({}));
              throw new Error(result.message || 'Не вдалося видалити відгук.');
            }

            await syncRequestUI();
          })
          .catch((error) => {
            console.error('Помилка видалення відгуку:', error);
            alert(error.message || 'Не вдалося видалити відгук.');
          });
        return;
      }

      void syncRequestUI();
    }

    const deleteOwnPostButton = event.target.closest('.delete-own-post-button');
    if (deleteOwnPostButton) {
      const card = deleteOwnPostButton.closest('[data-owned-post-id], .post[data-request-id]');
      if (!card) return;

      const postId = card.dataset.ownedPostId || card.dataset.requestId;
      if (/^\d+$/.test(String(postId))) {
        fetch(`/posts/${postId}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        })
          .then(async (response) => {
            if (!response.ok) {
              const result = await response.json().catch(() => ({}));
              throw new Error(result.message || 'Не вдалося видалити допис.');
            }

            await syncRequestUI();
          })
          .catch((error) => {
            console.error('Помилка видалення допису:', error);
            alert(error.message || 'Не вдалося видалити допис.');
          });
        return;
      }

      runtimeState.deletedOwnedPosts[postId] = true;
      void syncRequestUI();
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

  document.addEventListener('submit', async (event) => {
    const addPostForm = event.target.closest('#add-post-form');
    if (addPostForm) {
      event.preventDefault();

      const typeSelect = addPostForm.querySelector('select[name="type"]');
      const titleInput = addPostForm.querySelector('input[name="post-title"]');
      const descriptionInput = addPostForm.querySelector('textarea[name="post-text"]');
      const tagTitles = readTagsFromContainer(addPostForm.querySelector('#user-post-tags'));
      const previewImages = readImagesFromForm(addPostForm);

      try {
        const response = await fetch('/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            type: typeSelect?.value || 'fundraising',
            title: titleInput?.value.trim() || '',
            description: descriptionInput?.value.trim() || '',
            tags: tagTitles,
            images: previewImages,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          alert(result.message || 'Не вдалося створити допис.');
          return;
        }

        closeSharedModal('post-modal');
        addPostForm.reset();
        clearImageContainer('post-image-preview-container');
        const tags = addPostForm.querySelector('#user-post-tags');
        if (tags) tags.innerHTML = '';

        await syncRequestUI();
      } catch (error) {
        console.error('Помилка створення допису:', error);
        alert('Не вдалося створити допис. Спробуйте пізніше.');
      }
      return;
    }

    const editPostForm = event.target.closest('#edit-post-form');
    if (editPostForm) {
      event.preventDefault();

      const postId = editPostForm.dataset.postId;
      if (!postId) return;

      const payload = {
        type: editPostForm.querySelector('select[name="type"]')?.value || 'fundraising',
        title: editPostForm.querySelector('input[name="post-title"]')?.value.trim() || '',
        description: editPostForm.querySelector('textarea[name="post-text"]')?.value.trim() || '',
        tags: readTagsFromContainer(editPostForm.querySelector('#user-post-tags')),
        images: readImagesFromForm(editPostForm),
      };

      if (/^\d+$/.test(String(postId))) {
        try {
          const response = await fetch(`/posts/${postId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
          });

          const result = await response.json();
          if (!response.ok) {
            alert(result.message || 'Не вдалося оновити допис.');
            return;
          }

          closeSharedModal('post-modal');
          await syncRequestUI();
        } catch (error) {
          console.error('Помилка оновлення допису:', error);
          alert('Не вдалося оновити допис. Спробуйте пізніше.');
        }
        return;
      }

      updateStaticPostCard(postId, payload);
      closeSharedModal('post-modal');
      applyStatusToRequestCards();
      return;
    }

    const editProfileForm = event.target.closest('#edit-profile-form');
    if (editProfileForm) {
      event.preventDefault();
      upsertPendingProfileTag(editProfileForm);

      try {
        const response = await fetch('/auth/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            full_name: editProfileForm.querySelector('#profile-title')?.value.trim() || '',
            description: editProfileForm.querySelector('#profile-text')?.value.trim() || '',
            image_url: editProfileForm.querySelector('.profile-picture')?.getAttribute('src') || '',
            tags: readTagsFromContainer(editProfileForm.querySelector('#user-profile-tags')),
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          alert(result.message || 'Не вдалося оновити профіль.');
          return;
        }

        window.AuthState?.setUser(result.user);
        closeSharedModal('edit-profile-modal');
      } catch (error) {
        console.error('Помилка оновлення профілю:', error);
        alert('Не вдалося оновити профіль. Спробуйте пізніше.');
      }
      return;
    }

    const answerForm = event.target.closest('#answer-request-form');
    if (answerForm) {
      event.preventDefault();

      const requestId = answerForm.dataset.requestId;
      const sourceCard = document.querySelector(`.post[data-request-id="${requestId}"]`);
      if (!requestId || !sourceCard) return;

      try {
        const response = await fetch('/responses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            post_id: Number(requestId),
            title: answerForm.querySelector('#answer-title')?.value.trim() || '',
            description: answerForm.querySelector('#answer-text')?.value.trim() || '',
            images: readImagesFromForm(answerForm),
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          alert(result.message || 'Не вдалося надіслати відгук.');
          return;
        }

        await syncRequestUI();

        closeSharedModal('answer-request-modal');
        answerForm.reset();
        clearImageContainer('answer-image-preview-container');
      } catch (error) {
        console.error('Помилка надсилання відгуку:', error);
        alert('Не вдалося надіслати відгук. Спробуйте пізніше.');
      }
      return;
    }

    const reportForm = event.target.closest('#request-report-form');
    if (reportForm) {
      event.preventDefault();

      const requestId = activeReportContext?.requestId || reportForm.dataset.requestId;
      const responseId = activeReportContext?.responseId || reportForm.dataset.responseId;
      const reportRole = activeReportContext?.reportRole || reportForm.dataset.reportRole;
      const reportText = reportForm.querySelector('#report-text')?.value.trim() || '';
      const reportImages = readImagesFromForm(reportForm);

      if (!requestId || !reportRole) return;

      try {
        const response = await fetch('/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            post_id: Number(requestId),
            response_id: responseId ? Number(responseId) : null,
            reporter_role: reportRole,
            text: reportText,
            images: reportImages,
            request_snapshot: activeReportContext?.requestData || {},
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          alert(result.message || 'Не вдалося зберегти звіт.');
          return;
        }

        closeSharedModal('report-modal');
        activeReportContext = null;
        await syncRequestUI();
      } catch (error) {
        console.error('Помилка створення звіту:', error);
        alert('Не вдалося зберегти звіт. Спробуйте пізніше.');
      }
    }
  });
})();
