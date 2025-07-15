const navButtons = document.querySelectorAll('.nav-button a, #open-profile-button');
const fundraisersMain = document.getElementById('fundraisers-main');
const dynamicMain = document.getElementById('dynamic-main');

// Перевірка, чи користувач залогінений
function isUserLoggedIn() {
  return localStorage.getItem('loggedIn') === "true";
}

// Відкрити модальне вікно логіну (імітація кліку на кнопку логіну)
function openLoginModal() {
  document.getElementById('login-button')?.click();
}

// Функція для завантаження даних профілю користувача та вставки їх у DOM
async function loadUserProfile() {
  const userId = localStorage.getItem("userId");
  if (!userId) return;

  try {
    const res = await fetch(`/auth/profile?id=${userId}`);
    const result = await res.json();

    if (res.ok) {
      const { full_name, email, role } = result.user || result;

      const nameEl = document.getElementById("profile-name");
      const emailEl = document.getElementById("profile-email");
      const roleEl = document.getElementById("profile-role");

      if (nameEl) nameEl.textContent = full_name || "Нема імені";
      if (emailEl) emailEl.textContent = email || "Нема email";
      if (roleEl) roleEl.textContent = role || "Нема ролі";
    } else {
      console.error(result.message || "Не вдалося отримати профіль");
    }
  } catch (err) {
    console.error("Помилка при завантаженні профілю:", err);
  }
}

navButtons.forEach(link => {
  link.addEventListener('click', async (e) => {
    e.preventDefault();

    const page = link.dataset.page;

    if (page === 'user-profile') {
      document.getElementById('profile-dropdown')?.classList.add('hidden');

      if (!isUserLoggedIn()) {
        openLoginModal();
        return; // Забороняємо завантаження профілю без логіну
      }
    }

    localStorage.setItem('selectedPage', page);

    document.querySelectorAll('.nav-button').forEach(btn => {
      btn.classList.remove('active');
    });

    if (link.closest('.nav-button')) {
      link.closest('.nav-button').classList.add('active');
    }

    if (page === 'fundraisers') {
      fundraisersMain.classList.remove('hidden');
      dynamicMain.innerHTML = '';
      window.scrollTo(0, 0);
    } else {
      try {
        const res = await fetch(`/public/pages/components/${page}-main/${page}.html`);
        if (!res.ok) throw new Error("Page not found");

        const html = await res.text();
        dynamicMain.innerHTML = html;

        fundraisersMain.classList.add('hidden');
        window.scrollTo(0, 0);

        // Якщо це сторінка профілю — чекаємо появи елементів і завантажуємо дані
        if (page === 'user-profile') {
          const waitForProfileElements = () => new Promise(resolve => {
            const interval = setInterval(() => {
              if (
                document.getElementById("profile-name") &&
                document.getElementById("profile-email") &&
                document.getElementById("profile-role")
              ) {
                clearInterval(interval);
                resolve();
              }
            }, 50);
          });

          await waitForProfileElements();
          await loadUserProfile();
        }

      } catch (err) {
        dynamicMain.innerHTML = "<p style='padding: 1rem;'>Помилка завантаження сторінки.</p>";
        fundraisersMain.classList.add('hidden');
        console.error(err);
      }
    }
  });
});

window.addEventListener('DOMContentLoaded', () => {
  const savedPage = localStorage.getItem('selectedPage') || 'fundraisers';
  let linkToClick = document.querySelector(`.nav-button a[data-page="${savedPage}"]`);

  if (!linkToClick && savedPage === 'user-profile') {
    linkToClick = document.getElementById('open-profile-button');
  }

  if (savedPage === 'user-profile' && !isUserLoggedIn()) {
    openLoginModal();
    return;
  }

  if (linkToClick) {
    window.scrollTo(0, 0);
    linkToClick.click();
  }
});
