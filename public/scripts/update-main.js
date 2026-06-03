const navButtons = document.querySelectorAll('.nav-button a, #open-profile-button');
const fundraisersMain = document.getElementById('fundraisers-main');
const dynamicMain = document.getElementById('dynamic-main');
const PAGE_PATHS = {
  fundraisers: '/public/fundraisers.html',
  requests: '/public/requests.html',
  'accepted-requests': '/public/accepted-requests.html',
  reports: '/public/reports.html',
  military: '/public/military.html',
  volunteers: '/public/volunteers.html',
  admin: '/public/admin.html',
  'user-profile': '/public/user-profile.html',
  'public-user-profile': '/public/public-user-profile.html',
};
const protectedPages = new Set(['accepted-requests', 'reports', 'admin']);

function canAccessPage(page) {
  if (!isUserLoggedIn() && protectedPages.has(page)) {
    return false;
  }

  if (page === 'accepted-requests' && !window.AuthState?.isVolunteer?.()) {
    return false;
  }

  return true;
}

function isUserLoggedIn() {
  return Boolean(window.AuthState?.isLoggedIn());
}

function openLoginModal() {
  document.getElementById('login-button')?.click();
}

function resolvePageFromPath() {
  const currentPath = window.location.pathname;
  const matchedPage = Object.entries(PAGE_PATHS).find(([, pagePath]) => pagePath === currentPath);
  return matchedPage?.[0] || null;
}

function syncBrowserPath(page) {
  const nextPath = PAGE_PATHS[page];
  if (!nextPath || window.location.pathname === nextPath) {
    return;
  }

  window.history.replaceState({}, '', nextPath);
}

function syncNavHrefs() {
  document.querySelectorAll('.nav-button a[data-page], #open-profile-button[data-page]').forEach((link) => {
    const page = link.dataset.page;
    const nextPath = PAGE_PATHS[page];
    if (nextPath) {
      link.setAttribute('href', nextPath);
    }
  });
}

function setActiveNav(page) {
  document.querySelectorAll('.nav-button').forEach((btn) => {
    btn.classList.remove('active');
  });

  const activeLink = document.querySelector(`.nav-button a[data-page="${page}"]`);
  activeLink?.closest('.nav-button')?.classList.add('active');
}

async function hydrateProfilePage() {
  if (!isUserLoggedIn()) {
    return;
  }

  await window.AuthState?.refresh();
  window.AuthState?.renderUserProfile();
}

async function loadPage(page, options = {}) {
  const {
    persist = true,
    updatePath = true,
  } = options;
  const previousPage = localStorage.getItem('selectedPage') || resolvePageFromPath() || 'fundraisers';

  if (page === 'user-profile') {
    document.getElementById('profile-dropdown')?.classList.add('hidden');

    if (!isUserLoggedIn()) {
      openLoginModal();
      return;
    }
  }

  if (page === 'public-user-profile' && !window.PublicUserProfile?.getSelectedUserId?.()) {
    page = 'fundraisers';
  }

  if (!canAccessPage(page)) {
    page = 'fundraisers';
  }

  if (page !== previousPage) {
    window.SearchState?.clear?.(false);
  }

  if (persist) {
    localStorage.setItem('selectedPage', page);
  }

  if (updatePath) {
    syncBrowserPath(page);
  }

  setActiveNav(page);

  if (page === 'fundraisers') {
    fundraisersMain.classList.remove('hidden');
    dynamicMain.innerHTML = '';
    document.dispatchEvent(new CustomEvent('page:loaded', { detail: { page } }));
    window.scrollTo(0, 0);
    return;
  }

  try {
    window.LoadingUi?.showSectionLoader(dynamicMain, 'Завантажуємо сторінку...');
    const res = await fetch(`/public/pages/components/${page}-main/${page}.html`);
    if (!res.ok) {
      throw new Error('Page not found');
    }

    const html = await res.text();
    dynamicMain.innerHTML = html;
    document.dispatchEvent(new CustomEvent('page:loaded', { detail: { page } }));

    fundraisersMain.classList.add('hidden');
    window.scrollTo(0, 0);

    if (page === 'user-profile') {
      await hydrateProfilePage();
      return;
    }

    if (page === 'public-user-profile') {
      await window.PublicUserProfile?.renderCurrentProfile?.();
    }
  } catch (error) {
    dynamicMain.innerHTML = "<p style='padding: 1rem;'>Помилка завантаження сторінки.</p>";
    fundraisersMain.classList.add('hidden');
    console.error(error);
  }
}

navButtons.forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    void loadPage(link.dataset.page);
  });
});

window.addEventListener('DOMContentLoaded', async () => {
  await window.AuthState?.init();
  syncNavHrefs();

  const pageFromPath = resolvePageFromPath();
  const savedPage = pageFromPath || localStorage.getItem('selectedPage') || 'fundraisers';
  const initialPage = canAccessPage(savedPage)
    ? savedPage
    : 'fundraisers';

  if (initialPage === 'user-profile' && !isUserLoggedIn()) {
    localStorage.setItem('selectedPage', 'fundraisers');
    syncBrowserPath('fundraisers');
    await loadPage('fundraisers', { persist: false, updatePath: false });
    return;
  }

  await loadPage(initialPage, { persist: false, updatePath: false });
});

document.addEventListener('auth:changed', async (event) => {
  if (!event.detail.authenticated) {
    const restrictedPages = new Set(['accepted-requests', 'reports', 'user-profile', 'admin']);
    if (restrictedPages.has(localStorage.getItem('selectedPage'))) {
      localStorage.setItem('selectedPage', 'fundraisers');
      syncBrowserPath('fundraisers');
      await loadPage('fundraisers', { persist: false, updatePath: false });
    }
    return;
  }

  if (!window.AuthState?.isVolunteer?.() && localStorage.getItem('selectedPage') === 'accepted-requests') {
    localStorage.setItem('selectedPage', 'fundraisers');
    syncBrowserPath('fundraisers');
    await loadPage('fundraisers', { persist: false, updatePath: false });
    return;
  }

  if (document.querySelector('.user-profile')) {
    window.AuthState?.renderUserProfile();
  }

  if (document.querySelector('.public-user-profile-page')) {
    await window.PublicUserProfile?.renderCurrentProfile?.();
  }
});

window.AppShell = {
  loadPage,
  getCurrentPage() {
    return localStorage.getItem('selectedPage') || resolvePageFromPath() || 'fundraisers';
  },
};
