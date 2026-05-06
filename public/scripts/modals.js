import { initTogglePassword } from './toggle-password.js';

let escapeHandlerBound = false;

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

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.delete-profile-picture')) {
      return;
    }

    const profileImage = document.querySelector('#edit-profile-form .profile-picture');
    if (profileImage) {
      profileImage.src = '/public/images/account-icon.png';
    }

    const uploadInput = document.getElementById('profile-image-upload');
    if (uploadInput) {
      uploadInput.value = '';
    }
  });

  document.addEventListener('change', (e) => {
    if (!e.target.matches('#profile-image-upload')) {
      return;
    }

    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const profileImage = document.querySelector('#edit-profile-form .profile-picture');
      if (profileImage) {
        profileImage.src = loadEvent.target?.result || '/public/images/account-icon.png';
      }
    };
    reader.readAsDataURL(file);
  });

  logoutButton?.addEventListener('click', async () => {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch (error) {
      console.error('РџРѕРјРёР»РєР° РІРёС…РѕРґСѓ:', error);
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
    heading.textContent = 'Р РµС”СЃС‚СЂР°С†С–СЏ';
    registrationForm.classList.add('active-modal');
    loginForm.classList.remove('active-modal');
  });

  loginLink?.addEventListener('click', (e) => {
    e.preventDefault();
    heading.textContent = 'Р’С…С–Рґ';
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
        alert(result.message || 'РќРµРІС–СЂРЅРёР№ email Р°Р±Рѕ РїР°СЂРѕР»СЊ.');
        return;
      }

      window.AuthState?.setUser(result.user);
      closeModal();
    } catch (error) {
      console.error('РџРѕРјРёР»РєР° РІС…РѕРґСѓ:', error);
      alert('РЎРµСЂРІРµСЂ РЅРµРґРѕСЃС‚СѓРїРЅРёР№. РЎРїСЂРѕР±СѓР№С‚Рµ РїС–Р·РЅС–С€Рµ.');
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
        alert(result.message || 'РџРѕРјРёР»РєР° СЂРµС”СЃС‚СЂР°С†С–С—.');
        return;
      }

      registrationForm.reset();
      window.AuthState?.setUser(result.user);
      closeModal();
    } catch (error) {
      console.error('РџРѕРјРёР»РєР° СЂРµС”СЃС‚СЂР°С†С–С—:', error);
      alert('РЎС‚Р°Р»Р°СЃСЏ РїРѕРјРёР»РєР°. РЎРїСЂРѕР±СѓР№С‚Рµ РїС–Р·РЅС–С€Рµ.');
    }
  });
}

function bindSharedModalClose() {
  if (escapeHandlerBound) {
    return;
  }

  escapeHandlerBound = true;
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

  heading.textContent = 'Р’С…С–Рґ';
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

  heading.textContent = mode === 'edit' ? 'Р РµРґР°РіСѓРІР°С‚Рё РґРѕРїРёСЃ' : 'РЎС‚РІРѕСЂРёС‚Рё РґРѕРїРёСЃ';
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
