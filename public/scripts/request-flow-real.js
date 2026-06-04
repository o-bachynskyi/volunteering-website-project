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

  function getCurrentUserRoleCode() {
    return window.AuthState?.getUser()?.role_code || null;
  }

  function getCurrentUserRoleName() {
    return String(window.AuthState?.getUser()?.role_name || '').trim().toLowerCase();
  }

  function isCurrentUserMilitary() {
    return getCurrentUserRoleCode() === 'mi' || getCurrentUserRoleName() === 'військовий';
  }

  function isCurrentUserVolunteer() {
    return getCurrentUserRoleCode() === 'vo' || getCurrentUserRoleName() === 'волонтер';
  }

  function normalizeId(value) {
    return String(value ?? '').trim();
  }

  function resolvePostTypePayload(select) {
    const selectedOption = select?.selectedOptions?.[0] || null;
    const selectedValue = String(selectedOption?.value || select?.value || '').trim().toLowerCase();
    const selectedLabel = String(selectedOption?.textContent || '').trim().toLowerCase();
    const isMilitary = isCurrentUserMilitary();

    if (!isMilitary) {
      return 'fundraising';
    }

    if (selectedValue === 'request' || selectedLabel.includes('запит')) {
      return 'request';
    }

    return 'fundraising';
  }

  function canCurrentUserRespondToRequests() {
    return !isLoggedIn() || isCurrentUserVolunteer();
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

  function formatReportRequestDate(value) {
    if (!value) {
      return 'Невідомо';
    }

    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed)) {
      return formatDateTime(parsed);
    }

    return String(value);
  }

  function getSortableTimestamp(entry) {
    if (!entry) return 0;

    const directTimestamp = Number(entry.createdAt);
    if (Number.isFinite(directTimestamp) && directTimestamp > 0) {
      return directTimestamp;
    }

    if (entry.createdAtIso) {
      const parsedIso = new Date(entry.createdAtIso).getTime();
      if (Number.isFinite(parsedIso)) {
        return parsedIso;
      }
    }

    return 0;
  }

  function pluralizeUkrainian(value, forms) {
    const normalized = Math.abs(value) % 100;
    const lastDigit = normalized % 10;

    if (normalized > 10 && normalized < 20) {
      return forms[2];
    }

    if (lastDigit === 1) {
      return forms[0];
    }

    if (lastDigit >= 2 && lastDigit <= 4) {
      return forms[1];
    }

    return forms[2];
  }

  function formatDateTextForCard(timestamp) {
    if (!timestamp) return 'щойно';

    const numericTimestamp = Number(timestamp);
    const diff = Math.max(0, Date.now() - numericTimestamp);
    const oneMinute = 60 * 1000;
    const oneHour = 60 * oneMinute;
    const oneDay = 24 * oneHour;
    const oneWeek = 7 * oneDay;

    if (diff < oneMinute) {
      return 'щойно';
    }

    if (diff < oneHour) {
      const minutes = Math.max(1, Math.floor(diff / oneMinute));
      return `${minutes} ${pluralizeUkrainian(minutes, ['хвилину', 'хвилини', 'хвилин'])} тому`;
    }

    if (diff < oneDay) {
      const hours = Math.max(1, Math.floor(diff / oneHour));
      return `${hours} ${pluralizeUkrainian(hours, ['годину', 'години', 'годин'])} тому`;
    }

    if (diff >= oneWeek) {
      return new Intl.DateTimeFormat('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(numericTimestamp));
    }

    const days = Math.max(1, Math.floor(diff / oneDay));
    return `${days} ${pluralizeUkrainian(days, ['день', 'дні', 'днів'])} тому`;
  }

  function formatCardDateValue(value, fallbackTimestamp) {
    const directTimestamp = Number(value);
    if (Number.isFinite(directTimestamp) && directTimestamp > 0) {
      return formatDateTextForCard(directTimestamp);
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = new Date(value).getTime();
      if (Number.isFinite(parsed)) {
        return formatDateTextForCard(parsed);
      }
    }

    return formatDateTextForCard(fallbackTimestamp);
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

  function buildAuthorAvatar(userId, avatar, name) {
    return `
      <button type="button" class="post-author-trigger user-profile-open" data-user-id="${escapeHtml(userId || '')}" aria-label="Відкрити профіль ${escapeHtml(name || 'користувача')}">
        <img src="${escapeHtml(avatar)}" alt="User Profile Picture" class="post-profile-pic">
      </button>
    `;
  }

  function buildAuthorName(userId, name) {
    return `
      <button type="button" class="post-author-name user-profile-open" data-user-id="${escapeHtml(userId || '')}">
        ${escapeHtml(name || 'Користувач')}
      </button>
    `;
  }

  function renderDataLoadingState() {
    window.LoadingUi?.showSectionLoader(
      document.getElementById('generated-profile-posts'),
      'Завантажуємо ваші дописи...'
    );
    window.LoadingUi?.showSectionLoader(
      document.getElementById('generated-fundraiser-posts'),
      'Завантажуємо збори...'
    );
    window.LoadingUi?.showSectionLoader(
      document.getElementById('generated-request-feed-posts'),
      'Завантажуємо запити...'
    );
    window.LoadingUi?.showSectionLoader(
      document.getElementById('accepted-requests-list'),
      'Завантажуємо прийняті запити...'
    );
    window.LoadingUi?.showSectionLoader(
      document.getElementById('reports-list'),
      'Завантажуємо звіти...'
    );

    document.getElementById('accepted-requests-empty')?.classList.add('hidden');
    document.getElementById('reports-empty')?.classList.add('hidden');
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
      .sort((a, b) => getSortableTimestamp(b) - getSortableTimestamp(a));
  }

  function getOwnedPostsSorted() {
    const currentUserId = getCurrentUserId();
    return getAllPostsSorted().filter((post) => currentUserId && post.authorId === currentUserId);
  }

  function getReportsSorted() {
    return [...apiState.reports].sort((a, b) => getSortableTimestamp(b) - getSortableTimestamp(a));
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

  function matchesSearchValue(value, query) {
    if (!query) return true;
    return normalizeSearchText(value).includes(query);
  }

  function hasMatchingTag(tags = [], selectedTags = []) {
    if (!selectedTags.length) return true;

    const normalizedTags = tags.map((tag) => normalizeSearchText(tag));
    return selectedTags.every((tag) => normalizedTags.includes(tag));
  }

  function matchesSearchState(fields = [], tags = []) {
    const { query, tags: selectedTags } = getSearchState();
    const matchesQuery = !query || fields.some((field) => matchesSearchValue(field, query));
    return matchesQuery && hasMatchingTag(tags, selectedTags);
  }

  function renderSearchEmptyState(container, message) {
    if (!container) return;

    container.innerHTML = `
      <div class="search-empty-state">
        <p class="search-empty-state-title">${escapeHtml(message)}</p>
      </div>
    `;
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
            ${buildAuthorAvatar(request.authorId, request.avatar, request.authorName)}
            <div class="post-data">
              <div class="user-info">
                <p class="name">${buildAuthorName(request.authorId, request.authorName)}</p>
                <p class="dot">•</p>
                <time class="post-date">${escapeHtml(formatCardDateValue(request.acceptedDateText || request.acceptedAt, request.createdAt))}</time>
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
    const answerButtonMarkup = canCurrentUserRespondToRequests()
      ? `
          <button class="answer-request-button" aria-label="Відгукнутись">
            <span class="button-text">Відгукнутись</span>
            <img class="button-icon" src="/public/images/answer-icon.png" alt="Відгук icon">
          </button>
        `
      : '';

    return `
      <article class="post request-post-card" data-request-id="${escapeHtml(request.postId)}" data-request-status="${escapeHtml(request.status)}" data-request-context="request-feed">
        <header class="request-post-header">
          <div class="request-post-header-left">
            ${buildAuthorAvatar(request.authorId, request.avatar, request.authorName)}
            <div class="post-data">
              <div class="user-info">
                <p class="name">${buildAuthorName(request.authorId, request.authorName)}</p>
                <p class="dot">•</p>
                <time class="post-date">${escapeHtml(request.dateText)}</time>
              </div>
              <p class="user-role">${escapeHtml(request.authorRole || 'Користувач')}</p>
              <p class="request-status ${isClosed ? 'is-closed' : 'is-open'}">${isClosed ? 'Закритий' : 'Відкритий'}</p>
            </div>
          </div>
          ${answerButtonMarkup}
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
    const canDeletePost = !request.hasLinkedActivity;
    const actions = [];

    if (!isClosed) {
      actions.push(`
        <button class="post-dropdown-item edit-post-button">
          <img src="/public/images/edit-icon.png" alt="edit post">
          Редагувати
        </button>
      `);
      actions.push(`
        <button class="post-dropdown-item close-request-button" data-report-role="author">
          <img src="/public/images/close-modal-icon.png" alt="close request">
          Закрити
        </button>
      `);
    }

    if (canDeletePost) {
      actions.push(`
        <button class="post-dropdown-item delete-own-post-button">
          <img src="/public/images/delete-icon.png" alt="delete post">
          Видалити
        </button>
      `);
    }

    const ownerActions = actions.length ? `
      <div class="accepted-request-actions">
        <button class="post-more-button">
          <img src="/public/images/more-icon.png" alt="more">
        </button>
        <div class="post-more-dropdown hidden">
          ${actions.join('')}
        </div>
      </div>
    ` : '';

    return `
      <article class="post request-post-card" data-request-id="${escapeHtml(request.postId)}" data-owned-post-id="${escapeHtml(request.postId)}" data-request-status="${escapeHtml(request.status)}" data-request-context="author-feed">
        <header class="request-post-header has-owner-actions">
          <div class="request-post-header-left">
            ${buildAuthorAvatar(request.authorId, request.avatar, request.authorName)}
            <div class="post-data">
              <div class="user-info">
                <p class="name">${buildAuthorName(request.authorId, request.authorName)}</p>
                <p class="dot">•</p>
                <time class="post-date">${escapeHtml(request.dateText)}</time>
              </div>
              <p class="user-role">${escapeHtml(request.authorRole || 'Користувач')}</p>
              <p class="request-status ${isClosed ? 'is-closed' : 'is-open'}">${isClosed ? 'Закритий' : 'Відкритий'}</p>
            </div>
          </div>
          ${ownerActions}
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
    const canDeletePost = !post.hasLinkedActivity;
    const requestStatus = isRequest ? `<p class="request-status ${isClosed ? 'is-closed' : 'is-open'}">${isClosed ? 'Закритий' : 'Відкритий'}</p>` : '';
    const actions = [];

    if (!isRequest || !isClosed) {
      actions.push(`
        <button class="post-dropdown-item edit-post-button">
          <img src="/public/images/edit-icon.png" alt="edit post">
          Редагувати
        </button>
      `);
    }

    if (isRequest && !isClosed) {
      actions.push(`
        <button class="post-dropdown-item close-request-button" data-report-role="author">
          <img src="/public/images/close-modal-icon.png" alt="close request">
          Закрити
        </button>
      `);
    }

    if (canDeletePost) {
      actions.push(`
        <button class="post-dropdown-item delete-own-post-button">
          <img src="/public/images/delete-icon.png" alt="delete post">
          Видалити
        </button>
      `);
    }

    const ownerActions = actions.length ? `
      <div class="accepted-request-actions">
        <button class="post-more-button">
          <img src="/public/images/more-icon.png" alt="more">
        </button>
        <div class="post-more-dropdown hidden">
          ${actions.join('')}
        </div>
      </div>
    ` : '';

    return `
      <article class="post ${isRequest ? 'request-post-card' : ''}" data-owned-post-id="${escapeHtml(post.postId)}" ${isRequest ? `data-request-id="${escapeHtml(post.postId)}" data-request-status="${escapeHtml(post.status)}" data-request-context="author"` : ''}>
        <header class="post-header">
          ${buildAuthorAvatar(post.authorId, post.avatar, post.authorName)}
          <div class="post-data">
            <div class="user-info">
              <p class="name">${buildAuthorName(post.authorId, post.authorName)}</p>
              <p class="dot">•</p>
              <time class="post-date">${escapeHtml(post.dateText)}</time>
            </div>
            <p class="user-role">${escapeHtml(post.authorRole || 'Користувач')}</p>
            ${requestStatus}
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

  function buildFundraiserCard(post) {
    const canDeletePost = !post.hasLinkedActivity;
    const ownerActions = post.isOwnPost ? `
      <button class="post-more-button">
        <img src="/public/images/more-icon.png" alt="more">
      </button>
      <div class="post-more-dropdown hidden">
        <button class="post-dropdown-item edit-post-button">
          <img src="/public/images/edit-icon.png" alt="edit post">
          Редагувати
        </button>
        ${canDeletePost ? `
          <button class="post-dropdown-item delete-own-post-button">
            <img src="/public/images/delete-icon.png" alt="delete post">
            Видалити
          </button>
        ` : ''}
      </div>
    ` : '';

    return `
      <article class="post" data-owned-post-id="${escapeHtml(post.isOwnPost ? post.postId : '')}">
        <header class="post-header">
          ${buildAuthorAvatar(post.authorId, post.avatar, post.authorName)}
          <div class="post-data">
            <div class="user-info">
              <p class="name">${buildAuthorName(post.authorId, post.authorName)}</p>
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

    return `
      <article class="report-record-card">
        <div class="report-record-main">
          <div class="report-record-copy">
            <p class="report-record-type">${escapeHtml(report.reportTitle)}</p>
            <h3 class="report-record-title">${escapeHtml(requestTitle)}</h3>
            <p class="report-record-meta">Створено: ${escapeHtml(formatDateTime(report.createdAt))}</p>
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

    const posts = getOwnedPostsSorted()
      .filter((post) => matchesSearchState(
        [post.title, post.description, post.authorName, post.authorRole],
        post.tags
      ));

    if (!posts.length && isSearchActive()) {
      renderSearchEmptyState(container, 'За вашим запитом у профілі нічого не знайдено.');
      return;
    }

    container.innerHTML = posts
      .map((post) => buildProfileGeneratedPostCard({
        ...post,
        status: post.status,
      }))
      .join('');
  }

  function renderGeneratedFundraisers() {
    const container = document.getElementById('generated-fundraiser-posts');
    if (!container) return;

    const posts = getAllPostsSorted()
      .filter((post) => post.type === 'fundraising')
      .filter((post) => matchesSearchState(
        [post.title, post.description, post.authorName, post.authorRole],
        post.tags
      ));

    if (!posts.length && isSearchActive()) {
      renderSearchEmptyState(container, 'За вашим запитом зборів не знайдено.');
      return;
    }

    container.innerHTML = posts.map(buildFundraiserCard).join('');
  }

  function renderGeneratedRequestFeed() {
    const container = document.getElementById('generated-request-feed-posts');
    if (!container) return;

    const posts = getAllPostsSorted()
      .filter((post) => post.type === 'request')
      .filter((post) => matchesSearchState(
        [post.title, post.description, post.authorName, post.authorRole, post.status],
        post.tags
      ));

    if (!posts.length && isSearchActive()) {
      renderSearchEmptyState(container, 'За вашим запитом запитів не знайдено.');
      return;
    }

    container.innerHTML = posts.map((post) => buildRequestFeedCard(post)).join('');
  }

  function renderAcceptedRequests() {
    const list = document.getElementById('accepted-requests-list');
    const empty = document.getElementById('accepted-requests-empty');
    if (!list || !empty) return;

    const acceptedRequests = [...apiState.responses]
      .sort((a, b) => getSortableTimestamp(b) - getSortableTimestamp(a))
      .filter((request) => matchesSearchState(
        [request.title, request.description, request.authorName, request.authorRole, request.status],
        request.tags
      ));

    if (!acceptedRequests.length) {
      if (isSearchActive()) {
        empty.classList.add('hidden');
        renderSearchEmptyState(list, 'За вашим запитом прийнятих запитів не знайдено.');
        return;
      }

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

    const reports = getReportsSorted().filter((report) => matchesSearchState(
      [
        report.reportTitle,
        report.description,
        report.requestSnapshot?.title,
        report.requestSnapshot?.description,
        report.requestSnapshot?.authorName,
        report.reporterUserName,
        report.reporterUserRole,
      ],
      report.requestSnapshot?.tags || []
    ));

    if (!reports.length) {
      if (isSearchActive()) {
        empty.classList.add('hidden');
        renderSearchEmptyState(list, 'За вашим запитом звітів не знайдено.');
        return;
      }

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

      if (!canCurrentUserRespondToRequests()) {
        answerButton.classList.remove('is-accepted');
        answerButton.classList.add('hidden');
        answerButton.disabled = true;
        return;
      }

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
            <p class="report-document-request-meta">Дата запиту: ${escapeHtml(formatReportRequestDate(request.dateText))}</p>
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(report.reportTitle)}</title>
  <link rel="stylesheet" href="/public/styles/styles.css">
  <link rel="stylesheet" href="/public/pages/components/user-profile-main/user-profile.css">
  <link rel="stylesheet" href="/public/pages/components/reports-main/reports.css">
  <style>
    :root {
      color-scheme: light;
      --export-bg: #ececec;
      --export-surface: #f5f5f5;
      --export-paper: #ffffff;
      --export-border: #dddddd;
      --export-border-soft: #e8e8e8;
      --export-text: #1c1c1c;
      --export-text-muted: #666666;
      --export-pill: #dedede;
      --export-accent: #d9d9d9;
    }

    * {
      box-sizing: border-box;
    }

    body {
      min-height: 100vh;
      margin: 0;
      padding: 32px 20px 40px;
      background:
        radial-gradient(circle at top left, rgba(255, 255, 255, 0.9), transparent 38%),
        linear-gradient(180deg, #f4f4f4 0%, var(--export-bg) 100%);
      color: var(--export-text);
      font-family: Arial, sans-serif;
    }

    .export-report-shell {
      width: min(920px, 100%);
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .export-report-header {
      background: linear-gradient(180deg, #f4f4f4 0%, var(--export-surface) 100%);
      border: 1px solid var(--export-border-soft);
      border-radius: 28px;
      padding: 24px 28px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    }

    .export-report-header-top {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }

    .export-report-brand-kicker {
      margin: 0 0 8px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--export-text-muted);
    }

    .export-report-brand-title {
      margin: 0;
      font-size: 32px;
      line-height: 1.15;
      color: var(--export-text);
    }

    .export-report-brand-subtitle {
      margin: 10px 0 0;
      max-width: 620px;
      font-size: 15px;
      line-height: 1.55;
      color: #4f4f4f;
    }

    .export-report-status {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 38px;
      padding: 8px 16px;
      border-radius: 999px;
      background: var(--export-accent);
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      white-space: nowrap;
    }

    .export-report-summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
    }

    .export-report-summary-item {
      padding: 14px 16px;
      border-radius: 18px;
      background: var(--export-paper);
      border: 1px solid var(--export-border-soft);
    }

    .export-report-summary-label {
      margin: 0 0 6px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      color: var(--export-text-muted);
    }

    .export-report-summary-value {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.35;
      color: var(--export-text);
    }

    .export-report-paper {
      border-radius: 28px;
      background: var(--export-paper);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
      overflow: hidden;
    }

    .report-document-sheet {
      box-shadow: none;
      border-radius: 0;
      padding: 30px 32px 34px;
    }

    .report-document-header {
      padding-bottom: 20px;
      border-bottom: 1px solid var(--export-border);
    }

    .report-document-title {
      line-height: 1.2;
    }

    .report-document-meta-grid {
      gap: 14px;
    }

    .report-document-meta-grid > div {
      padding: 14px 16px;
      border-radius: 16px;
      background: #fafafa;
      border: 1px solid var(--export-border-soft);
    }

    .report-document-section {
      margin-top: 26px;
    }

    .report-document-section h3 {
      display: inline-flex;
      align-items: center;
      min-height: 38px;
      margin: 0 0 14px;
      padding: 7px 16px;
      border-radius: 999px;
      background: var(--export-pill);
      font-size: 17px;
      font-weight: 700;
    }

    .report-document-request {
      background:
        linear-gradient(180deg, #fbfbfb 0%, #f6f6f6 100%);
      border: 1px solid var(--export-border-soft);
      border-radius: 22px;
      padding: 20px;
    }

    .report-document-request-title {
      line-height: 1.25;
    }

    .report-document-text {
      padding: 18px 20px;
      border-radius: 18px;
      background: #fafafa;
      border: 1px solid var(--export-border-soft);
    }

    .report-document-subsection h4 {
      font-size: 15px;
      font-weight: 700;
    }

    .report-document-tag {
      background: var(--export-accent);
      color: var(--export-text);
    }

    .report-document-images {
      gap: 14px;
    }

    .report-document-image {
      border-radius: 18px;
      border: 1px solid var(--export-border);
      background: #fbfbfb;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
    }

    .export-report-footer {
      text-align: center;
      font-size: 13px;
      line-height: 1.5;
      color: var(--export-text-muted);
      padding: 0 12px;
    }

    .export-report-footer strong {
      color: #404040;
    }

    @media print {
      @page {
        size: auto;
        margin: 12mm;
      }

      body {
        padding: 0;
        background: #ffffff;
      }

      .export-report-shell {
        width: 100%;
        margin: 0;
        gap: 12px;
      }

      .export-report-header,
      .export-report-paper {
        box-shadow: none;
      }

      .export-report-header {
        border-radius: 0;
        border-color: var(--export-border);
        background: #ffffff;
      }

      .report-document-sheet {
        border-radius: 0;
        padding: 22px 0 0;
      }

      .report-document-section h3 {
        border: 1px solid var(--export-border);
        background: #f5f5f5;
      }

      .report-document-request,
      .report-document-text,
      .report-document-meta-grid > div {
        background: #ffffff;
      }

      .export-report-footer {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <main class="export-report-shell report-preview-document">
    <section class="export-report-header">
      <div class="export-report-header-top">
        <div>
          <p class="export-report-brand-kicker">Вебсистема «Допомога Зараз»</p>
          <h1 class="export-report-brand-title">${escapeHtml(report.reportTitle)}</h1>
          <p class="export-report-brand-subtitle">Звіт про результати взаємодії між військовими та волонтерами, підготовлений на основі даних сервісу.</p>
        </div>
        <div class="export-report-status">${escapeHtml(report.reporterUserRole || (report.reporterRole === 'author' ? 'Військовий' : 'Волонтер'))}</div>
      </div>
      <div class="export-report-summary-grid">
        <article class="export-report-summary-item">
          <p class="export-report-summary-label">Номер звіту</p>
          <p class="export-report-summary-value">${escapeHtml(report.reportId)}</p>
        </article>
        <article class="export-report-summary-item">
          <p class="export-report-summary-label">Дата створення</p>
          <p class="export-report-summary-value">${escapeHtml(formatDateTime(report.createdAt))}</p>
        </article>
        <article class="export-report-summary-item">
          <p class="export-report-summary-label">Тип звіту</p>
          <p class="export-report-summary-value">${escapeHtml(report.reporterRole === 'author' ? 'Підтвердження отримання допомоги' : 'Підтвердження надання допомоги')}</p>
        </article>
      </div>
    </section>
    <section class="export-report-paper">
      ${buildReportMarkup(report)}
    </section>
  </main>
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

    const html = buildReportExportDocument(report);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const exportUrl = URL.createObjectURL(blob);
    const reportWindow = window.open(exportUrl, '_blank');

    if (!reportWindow) {
      window.location.href = exportUrl;
      setTimeout(() => URL.revokeObjectURL(exportUrl), 60000);
      return;
    }

    reportWindow.focus?.();
    setTimeout(() => URL.revokeObjectURL(exportUrl), 60000);
  }

  function closeSharedModal(modalId) {
    document.getElementById('modal-overlay')?.classList.add('hidden');
    document.getElementById(modalId)?.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  function ensureDeletePostConfirmModalStyles() {
    if (document.getElementById('delete-post-confirm-style')) return;

    const style = document.createElement('style');
    style.id = 'delete-post-confirm-style';
    style.textContent = `
      .delete-post-confirm-overlay {
        position: fixed;
        inset: 0;
        background-color: rgba(68, 68, 68, 0.5);
        z-index: 135;
      }

      .delete-post-confirm-modal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: min(460px, calc(100vw - 32px));
        padding: 28px 26px 24px;
        border-radius: 24px;
        background: #f0f0f0;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
        z-index: 136;
        color: #1c1c1c;
      }

      .delete-post-confirm-kicker {
        margin: 0 0 8px;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #666666;
      }

      .delete-post-confirm-title {
        margin: 0 0 12px;
        font-size: 26px;
        line-height: 1.2;
      }

      .delete-post-confirm-text {
        margin: 0;
        font-size: 16px;
        line-height: 1.6;
        color: #444444;
      }

      .delete-post-confirm-name {
        display: inline-block;
        margin-top: 6px;
        font-weight: 700;
        color: #1c1c1c;
      }

      .delete-post-confirm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 22px;
      }

      .delete-post-confirm-button {
        min-width: 148px;
        height: 42px;
        padding: 0 18px;
        border: none;
        border-radius: 30px;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        transition: 0.3s;
      }

      .delete-post-confirm-button.cancel {
        background: #d9d9d9;
        color: #1c1c1c;
      }

      .delete-post-confirm-button.cancel:hover {
        background: #c6c6c6;
      }

      .delete-post-confirm-button.cancel:active {
        background: #b1b1b1;
      }

      .delete-post-confirm-button.danger {
        background: #c94d4d;
        color: #ffffff;
      }

      .delete-post-confirm-button.danger:hover {
        background: #b94242;
      }

      .delete-post-confirm-button.danger:active {
        background: #a63636;
      }

      @media (max-width: 560px) {
        .delete-post-confirm-actions {
          flex-direction: column;
        }

        .delete-post-confirm-button {
          width: 100%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureDeletePostConfirmModal() {
    ensureDeletePostConfirmModalStyles();

    let overlay = document.getElementById('delete-post-confirm-overlay');
    let modal = document.getElementById('delete-post-confirm-modal');

    if (overlay && modal) {
      return { overlay, modal };
    }

    overlay = document.createElement('div');
    overlay.id = 'delete-post-confirm-overlay';
    overlay.className = 'delete-post-confirm-overlay hidden';

    modal = document.createElement('div');
    modal.id = 'delete-post-confirm-modal';
    modal.className = 'delete-post-confirm-modal hidden';
    modal.innerHTML = `
      <p class="delete-post-confirm-kicker">Підтвердження дії</p>
      <h3 class="delete-post-confirm-title">Видалити допис?</h3>
      <p class="delete-post-confirm-text">
        Цю дію не можна буде скасувати.
        <br>
        <span class="delete-post-confirm-name" id="delete-post-confirm-name"></span>
      </p>
      <div class="delete-post-confirm-actions">
        <button type="button" class="delete-post-confirm-button cancel" id="delete-post-confirm-cancel">Скасувати</button>
        <button type="button" class="delete-post-confirm-button danger" id="delete-post-confirm-submit">Видалити</button>
      </div>
    `;

    const closeWith = (confirmed) => {
      const resolver = modal._resolver;
      modal._resolver = null;
      overlay.classList.add('hidden');
      modal.classList.add('hidden');
      document.body.classList.remove('modal-open');
      if (typeof resolver === 'function') {
        resolver(Boolean(confirmed));
      }
    };

    overlay.addEventListener('click', () => closeWith(false));
    modal.querySelector('#delete-post-confirm-cancel')?.addEventListener('click', () => closeWith(false));
    modal.querySelector('#delete-post-confirm-submit')?.addEventListener('click', () => closeWith(true));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeWith(false);
      }
    });

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    return { overlay, modal };
  }

  function confirmDeletePost(postTitle) {
    const { overlay, modal } = ensureDeletePostConfirmModal();
    const postName = modal.querySelector('#delete-post-confirm-name');

    if (postName) {
      postName.textContent = postTitle ? `«${postTitle}»` : 'Обраний допис';
    }

    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');

    return new Promise((resolve) => {
      modal._resolver = resolve;
    });
  }

  function performOwnedPostDeletion(card) {
    if (!card) return;

    const postId = card.dataset.ownedPostId || card.dataset.requestId;
    const normalizedPostId = normalizeId(postId);

    if (/^\d+$/.test(normalizedPostId)) {
      fetch(`/posts/${normalizedPostId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
        .then(async (response) => {
          if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            throw new Error(result.message || 'РќРµ РІРґР°Р»РѕСЃСЏ РІРёРґР°Р»РёС‚Рё РґРѕРїРёСЃ.');
          }

          await syncRequestUI();
        })
        .catch((error) => {
          console.error('РџРѕРјРёР»РєР° РІРёРґР°Р»РµРЅРЅСЏ РґРѕРїРёСЃСѓ:', error);
          alert(error.message || 'РќРµ РІРґР°Р»РѕСЃСЏ РІРёРґР°Р»РёС‚Рё РґРѕРїРёСЃ.');
        });
      return;
    }

    runtimeState.deletedOwnedPosts[normalizedPostId] = true;
    void syncRequestUI();
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

  function getImageUploadErrorMessage(form) {
    const errorElement = form?.querySelector('.image-upload-error');
    const message = errorElement?.textContent?.trim() || '';
    return message;
  }

  function clearImageUploadError(form) {
    const errorElement = form?.querySelector('.image-upload-error');
    if (!errorElement) return;

    errorElement.textContent = '';
    errorElement.classList.add('hidden');
  }

  function getBlockingImageUploadError(form) {
    const message = getImageUploadErrorMessage(form);
    if (!message) {
      return '';
    }

    const imageCount = readImagesFromForm(form).length;
    const maxImageCountMessage = 'Можна додати не більше 5 фото до одного допису.';

    if (message === maxImageCountMessage && imageCount > 0 && imageCount <= 5) {
      clearImageUploadError(form);
      return '';
    }

    return message;
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
    renderDataLoadingState();

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
  document.addEventListener('search:changed', () => {
    renderGeneratedProfilePosts();
    renderGeneratedFundraisers();
    renderGeneratedRequestFeed();
    renderAcceptedRequests();
    renderReports();
    applyStatusToRequestCards();
  });

  document.addEventListener('click', (event) => {
    const deleteOwnPostButton = event.target.closest('.delete-own-post-button');
    if (!deleteOwnPostButton) return;

    const card = deleteOwnPostButton.closest('[data-owned-post-id], .post[data-request-id]');
    if (!card) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const postTitle = card.querySelector('.post-title')?.textContent?.trim() || '';
    confirmDeletePost(postTitle).then((confirmed) => {
      if (!confirmed) return;
      performOwnedPostDeletion(card);
    });
  }, true);

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
      const normalizedPostId = normalizeId(postId);
      if (/^\d+$/.test(normalizedPostId)) {
        fetch(`/posts/${normalizedPostId}`, {
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

      runtimeState.deletedOwnedPosts[normalizedPostId] = true;
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

      const imageUploadError = getBlockingImageUploadError(addPostForm);
      if (imageUploadError) {
        window.LoadingUi?.clearAllLoadingButtons();
        alert(imageUploadError);
        return;
      }

      const typeSelect = addPostForm.querySelector('select[name="type"]');
      const titleInput = addPostForm.querySelector('input[name="post-title"]');
      const descriptionInput = addPostForm.querySelector('textarea[name="post-text"]');
      const tagTitles = readTagsFromContainer(addPostForm.querySelector('#user-post-tags'));
      const previewImages = readImagesFromForm(addPostForm);

      try {
        const selectedType = resolvePostTypePayload(typeSelect);
        const response = await fetch('/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            type: selectedType,
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

      const imageUploadError = getBlockingImageUploadError(editPostForm);
      if (imageUploadError) {
        window.LoadingUi?.clearAllLoadingButtons();
        alert(imageUploadError);
        return;
      }

      const postId = editPostForm.dataset.postId;
      if (!postId) return;

      const payload = {
        type: resolvePostTypePayload(editPostForm.querySelector('select[name="type"]')),
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
            images: [],
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
