const navButtons = document.querySelectorAll('.nav-button a, #open-profile-button');
const fundraisersMain = document.getElementById('fundraisers-main');
const dynamicMain = document.getElementById('dynamic-main');

function isUserLoggedIn() {
  return Boolean(window.AuthState?.isLoggedIn());
}

function openLoginModal() {
  document.getElementById('login-button')?.click();
}

async function hydrateProfilePage() {
  await window.AuthState?.refresh();
  window.AuthState?.renderUserProfile();
}

navButtons.forEach((link) => {
  link.addEventListener('click', async (e) => {
    e.preventDefault();

    const page = link.dataset.page;

    if (page === 'user-profile') {
      document.getElementById('profile-dropdown')?.classList.add('hidden');

      if (!isUserLoggedIn()) {
        openLoginModal();
        return;
      }
    }

    localStorage.setItem('selectedPage', page);

    document.querySelectorAll('.nav-button').forEach((btn) => {
      btn.classList.remove('active');
    });

    if (link.closest('.nav-button')) {
      link.closest('.nav-button').classList.add('active');
    }

    if (page === 'fundraisers') {
      fundraisersMain.classList.remove('hidden');
      dynamicMain.innerHTML = '';
      document.dispatchEvent(new CustomEvent('page:loaded', { detail: { page } }));
      window.scrollTo(0, 0);
      return;
    }

    try {
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
      }
    } catch (error) {
      dynamicMain.innerHTML = "<p style='padding: 1rem;'>Помилка завантаження сторінки.</p>";
      fundraisersMain.classList.add('hidden');
      console.error(error);
    }
  });
});

window.addEventListener('DOMContentLoaded', async () => {
  await window.AuthState?.init();

  const savedPage = localStorage.getItem('selectedPage') || 'fundraisers';
  const protectedPages = new Set(['accepted-requests', 'reports']);
  const initialPage = !isUserLoggedIn() && protectedPages.has(savedPage)
    ? 'fundraisers'
    : savedPage;
  let linkToClick = document.querySelector(`.nav-button a[data-page="${initialPage}"]`);

  if (!linkToClick && initialPage === 'user-profile') {
    linkToClick = document.getElementById('open-profile-button');
  }

  if (initialPage === 'user-profile' && !isUserLoggedIn()) {
    localStorage.setItem('selectedPage', 'fundraisers');
    linkToClick = document.querySelector('.nav-button a[data-page="fundraisers"]');
  }

  if (linkToClick) {
    window.scrollTo(0, 0);
    linkToClick.click();
  }
});

document.addEventListener('auth:changed', async (event) => {
  if (!event.detail.authenticated) {
    if (localStorage.getItem('selectedPage') === 'user-profile') {
      localStorage.setItem('selectedPage', 'fundraisers');
      document.querySelector('.nav-button a[data-page="fundraisers"]')?.click();
    }
    return;
  }

  if (document.querySelector('.user-profile')) {
    await hydrateProfilePage();
  }
});
