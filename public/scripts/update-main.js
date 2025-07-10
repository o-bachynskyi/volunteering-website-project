const navButtons = document.querySelectorAll('.nav-button a, #open-profile-button');
const fundraisersMain = document.getElementById('fundraisers-main');
const dynamicMain = document.getElementById('dynamic-main');

navButtons.forEach(link => {
  link.addEventListener('click', async (e) => {
    e.preventDefault();

    const page = link.dataset.page;

    // Save selected page to localStorage
    localStorage.setItem('selectedPage', page);

    document.querySelectorAll('.nav-button').forEach(btn => {
      btn.classList.remove('active');
    });

    // Add active only if link is inside a nav-button (sidebar)
    if (link.closest('.nav-button')) {
      link.closest('.nav-button').classList.add('active');
    }

    if (page === 'user-profile') {
      document.getElementById('profile-dropdown')?.classList.add('hidden');
    }

    if (page === 'fundraisers') {
      // Show static fundraisers
      fundraisersMain.classList.remove('hidden');
      dynamicMain.innerHTML = ''; // Remove previously injected page
      window.scrollTo(0, 0);
    } else {
      // Load and show dynamic page
      try {
        const res = await fetch(`/public/pages/components/${page}-main/${page}.html`);
        if (!res.ok) throw new Error("Page not found");
        const html = await res.text();
        dynamicMain.innerHTML = html;

        // Hide fundraisers
        fundraisersMain.classList.add('hidden');
        // Scroll to top on content change
        window.scrollTo(0, 0);
      } catch (err) {
        dynamicMain.innerHTML = "<p style='padding: 1rem;'>Помилка завантаження сторінки.</p>";
        fundraisersMain.classList.add('hidden');
        console.error(err);
      }
    }
  });
});

// Load saved page on initial load
window.addEventListener('DOMContentLoaded', () => {
  const savedPage = localStorage.getItem('selectedPage') || 'fundraisers';
  let linkToClick = document.querySelector(`.nav-button a[data-page="${savedPage}"]`);

  if (!linkToClick && savedPage === 'user-profile') {
    linkToClick = document.getElementById('open-profile-button');
  }

  if (linkToClick) {
    window.scrollTo(0, 0);
    linkToClick.click();
  }
});

