import { initTogglePassword } from './toggle-password.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginButton = document.getElementById('login-button');
  const addPostButton = document.getElementById('add-post-button');
  const modalContainer = document.getElementById('modal-container');
  const logoutButton = document.getElementById('logout-button');

  loginButton?.addEventListener('click', async () => {
    if (!document.getElementById('login-reg-modal')) {
      const res = await fetch('/public/pages/components/login-reg-form/login-reg-form.html');
      const html = await res.text();
      modalContainer.innerHTML = html;
      wireLoginRegistrationModal();
    }

    showLoginModal();
  });

  addPostButton?.addEventListener('click', async () => {
    if (!document.getElementById('post-modal')) {
      const res = await fetch('/public/pages/components/modal-forms/add-edit-post-form/add-edit-post.html');
      const html = await res.text();
      modalContainer.innerHTML = html;
      bindSharedModalClose();
    }

    showAddEditPostModal('add');
    document.getElementById('add-post-form')?.classList.add('active-modal');
    document.getElementById('edit-post-form')?.classList.remove('active-modal');
  });

  document.addEventListener('click', async (e) => {
    if (e.target.closest('.edit-post-button')) {
      if (!document.getElementById('post-modal')) {
        const res = await fetch('/public/pages/components/modal-forms/add-edit-post-form/add-edit-post.html');
        const html = await res.text();
        document.getElementById('modal-container').innerHTML = html;
        bindSharedModalClose();
      }

      showAddEditPostModal('edit');
      document.getElementById('add-post-form')?.classList.remove('active-modal');
      document.getElementById('edit-post-form')?.classList.add('active-modal');
    }
  });

  document.addEventListener('click', async (e) => {
    if (e.target.closest('.edit-profile-button')) {
      if (!document.getElementById('edit-profile-modal')) {
        const res = await fetch('/public/pages/components/modal-forms/edit-profile-form/edit-profile.html');
        const html = await res.text();
        document.getElementById('modal-container').innerHTML = html;
      }

      await window.AuthState?.refresh();
      window.AuthState?.renderUserProfile();

      document.getElementById('modal-overlay')?.classList.remove('hidden');
      document.getElementById('edit-profile-modal')?.classList.remove('hidden');
      document.body.classList.add('modal-open');

      bindSharedModalClose();
    }
  });

  document.addEventListener('click', async (e) => {
    if (e.target.closest('.answer-request-button')) {
      if (!document.getElementById('answer-request-modal')) {
        const res = await fetch('/public/pages/components/modal-forms/answer-request-form/answer-request.html');
        const html = await res.text();
        document.getElementById('modal-container').innerHTML = html;
      }

      document.getElementById('modal-overlay')?.classList.remove('hidden');
      document.getElementById('answer-request-modal')?.classList.remove('hidden');
      document.body.classList.add('modal-open');

      bindSharedModalClose();
    }
  });

  logoutButton?.addEventListener('click', async () => {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch (error) {
      console.error('Помилка виходу:', error);
    }

    window.AuthState?.clear();
    location.reload();
  });
});

function wireLoginRegistrationModal() {
  const modal = document.getElementById('login-reg-modal');
  const heading = modal?.querySelector('.modal-heading');
  const loginForm = document.getElementById('login-form');
  const registrationForm = document.getElementById('registration-form');
  const regLink = loginForm?.querySelector('.footer a');
  const loginLink = registrationForm?.querySelector('.footer a');

  initTogglePassword();
  bindSharedModalClose();

  regLink?.addEventListener('click', (e) => {
    e.preventDefault();
    heading.textContent = 'Реєстрація';
    registrationForm.classList.add('active-modal');
    loginForm.classList.remove('active-modal');
  });

  loginLink?.addEventListener('click', (e) => {
    e.preventDefault();
    heading.textContent = 'Вхід';
    loginForm.classList.add('active-modal');
    registrationForm.classList.remove('active-modal');
  });

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = loginForm.querySelector('#email_login')?.value.trim();
    const password = loginForm.querySelector('#password_login')?.value;

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        alert(result.message || 'Невірний email або пароль.');
        return;
      }

      window.AuthState?.setUser(result.user);
      closeModal();
    } catch (error) {
      console.error('Помилка входу:', error);
      alert('Сервер недоступний. Спробуйте пізніше.');
    }
  });

  registrationForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = registrationForm.querySelector('#username_registration')?.value.trim();
    const rnokpp = registrationForm.querySelector('#rnokpp_registration')?.value.trim();
    const email = registrationForm.querySelector('#email_registration')?.value.trim();
    const password = registrationForm.querySelector('#password-registration')?.value;
    const roleId = registrationForm.querySelector('#role')?.value;

    try {
      const response = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          full_name: fullName,
          rnokpp,
          email,
          password,
          role_id: roleId,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        alert(result.message || 'Помилка реєстрації.');
        return;
      }

      registrationForm.reset();
      window.AuthState?.setUser(result.user);
      closeModal();
    } catch (error) {
      console.error('Помилка реєстрації:', error);
      alert('Сталася помилка. Спробуйте пізніше.');
    }
  });
}

function bindSharedModalClose() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
}

function showLoginModal() {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('login-reg-modal');
  const heading = modal?.querySelector('.modal-heading');
  const loginForm = document.getElementById('login-form');
  const registrationForm = document.getElementById('registration-form');

  if (!overlay || !modal || !heading || !loginForm || !registrationForm) {
    return;
  }

  heading.textContent = 'Вхід';
  loginForm.classList.add('active-modal');
  registrationForm.classList.remove('active-modal');

  overlay.classList.remove('hidden');
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function showAddEditPostModal(mode = 'add') {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('post-modal');
  const heading = modal?.querySelector('.modal-heading');

  if (!overlay || !modal || !heading) {
    return;
  }

  heading.textContent = mode === 'edit' ? 'Редагувати допис' : 'Створити допис';
  overlay.classList.remove('hidden');
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeModal() {
  document.getElementById('modal-overlay')?.classList.add('hidden');
  document.getElementById('login-reg-modal')?.classList.add('hidden');
  document.getElementById('post-modal')?.classList.add('hidden');
  document.getElementById('edit-profile-modal')?.classList.add('hidden');
  document.getElementById('answer-request-modal')?.classList.add('hidden');
  document.getElementById('report-modal')?.classList.add('hidden');
  document.body.classList.remove('modal-open');
}
