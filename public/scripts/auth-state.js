(function attachAuthState() {
  const defaultAvatar = '/public/images/account-icon.png';
  const protectedPages = new Set(['accepted-requests', 'user-profile']);
  const state = {
    authenticated: false,
    user: null,
    pending: null,
  };

  function dispatchAuthChanged() {
    document.dispatchEvent(
      new CustomEvent('auth:changed', {
        detail: {
          authenticated: state.authenticated,
          user: state.user,
        },
      })
    );
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) {
      element.textContent = value;
    }
  }

  function setImage(selector, src) {
    const element = document.querySelector(selector);
    if (element) {
      element.src = src;
    }
  }

  function updateHeaderUi() {
    document.getElementById('login-button')?.classList.toggle('hidden', state.authenticated);
    document.getElementById('add-post-button')?.classList.toggle('hidden', !state.authenticated);
    document.getElementById('profile-button')?.classList.toggle('hidden', !state.authenticated);
    document.getElementById('accepted-requests-div')?.classList.toggle('hidden', !state.authenticated);

    if (!state.authenticated) {
      document.getElementById('profile-dropdown')?.classList.add('hidden');
    }
  }

  function renderUserProfile() {
    const user = state.user;

    if (!user) {
      setText('.user-profile .profile-name', 'Гість');
      setText('.user-profile .profile-role', 'Неавторизований користувач');
      setText('.user-profile .profile-description', 'Увійдіть у систему, щоб переглянути та редагувати власний профіль.');
      setImage('.user-profile .profile-header img', defaultAvatar);
      setImage('#profile-button img', defaultAvatar);
      return;
    }

    setText('.user-profile .profile-name', user.full_name || 'Без імені');
    setText('.user-profile .profile-role', user.role_name || 'Роль не визначена');
    setText('.user-profile .profile-description', user.description || 'Опис поки що не заповнений.');
    setImage('.user-profile .profile-header img', user.image_url || defaultAvatar);
    setImage('#profile-button img', user.image_url || defaultAvatar);
  }

  function setAuthenticatedUser(user) {
    state.authenticated = true;
    state.user = user;
    updateHeaderUi();
    renderUserProfile();
    dispatchAuthChanged();
  }

  function clearAuthenticatedUser() {
    state.authenticated = false;
    state.user = null;
    updateHeaderUi();
    renderUserProfile();

    const selectedPage = localStorage.getItem('selectedPage');
    if (protectedPages.has(selectedPage)) {
      localStorage.setItem('selectedPage', 'fundraisers');
    }

    dispatchAuthChanged();
  }

  async function syncWithServer() {
    try {
      const response = await fetch('/auth/session', {
        credentials: 'same-origin',
      });

      if (!response.ok) {
        clearAuthenticatedUser();
        return null;
      }

      const result = await response.json();
      setAuthenticatedUser(result.user);
      return result.user;
    } catch (error) {
      console.error('Помилка перевірки сесії:', error);
      clearAuthenticatedUser();
      return null;
    }
  }

  async function init() {
    if (!state.pending) {
      state.pending = syncWithServer().finally(() => {
        state.pending = null;
      });
    }

    return state.pending;
  }

  window.AuthState = {
    init,
    isLoggedIn() {
      return state.authenticated;
    },
    getUser() {
      return state.user;
    },
    renderUserProfile,
    refresh() {
      return syncWithServer();
    },
    setUser(user) {
      setAuthenticatedUser(user);
    },
    clear() {
      clearAuthenticatedUser();
    },
  };
})();
