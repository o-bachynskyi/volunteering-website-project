async function loadLoginRegForm() {
  try {
    const response = await fetch('/public/pages/components/login-reg-form/login-reg-form.html');
    if (!response.ok) throw new Error('Не вдалося завантажити форму');
    const html = await response.text();

    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = html;

    // Покажемо модалку, знімаємо класи hidden
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('login-reg-modal').classList.remove('hidden');

    // Ініціалізуємо форму (повісити обробник submit)
    initRegisterForm();

    // Ініціалізуємо перемикання між формами
    initFormToggle();

    // Додаємо обробник закриття модалки
    document.getElementById('close-modal-button').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', closeModal);

  } catch (err) {
    console.error(err);
    alert('Сталася помилка при завантаженні форми');
  }
}

function closeModal() {
  const modal = document.getElementById('login-reg-modal');
  const overlay = document.getElementById('modal-overlay');
  if (modal) modal.classList.add('hidden');
  if (overlay) overlay.classList.add('hidden');
  // Очистимо модалку, щоб не було дублювання
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = '';
}

function initRegisterForm() {
  const registerForm = document.getElementById('registration-form');
  if (!registerForm) {
    console.log('Форма реєстрації відсутня на сторінці');
    return;
  }

  if (registerForm.hasRegisterHandler) return;
  registerForm.hasRegisterHandler = true;

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Натиснута кнопка реєстрації');

    const fullName = registerForm.querySelector('input[name="text"]').value;
    const email = registerForm.querySelector('input[name="email"]').value;
    const password = registerForm.querySelector('input[name="password"]').value;
    const selectedRole = registerForm.querySelector('select[name="role"]').value;

    const roleMap = {
      vo: 'vo', // заміни на актуальні ID
      mi: 'mi',
    };
    const roleId = roleMap[selectedRole] || selectedRole;

    console.log('Дані для реєстрації:', {
      full_name: fullName,
      email,
      password,
      role_id: roleId,
    });

    try {
      const response = await fetch('/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          role_id: roleId,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log('Реєстрація успішна:', result.message);
        alert('Успішна реєстрація!');
        registerForm.reset();
        closeModal();
      } else {
        console.error('Помилка реєстрації:', result.message);
        alert(result.message || 'Помилка реєстрації');
      }
    } catch (err) {
      console.error('Помилка при запиті:', err);
      alert('Сталася помилка. Спробуйте пізніше.');
    }
  });
}

function initFormToggle() {
  const loginForm = document.getElementById('login-form');
  const registrationForm = document.getElementById('registration-form');

  if (!loginForm || !registrationForm) return;

  // Посилання "Зареєструватись" в формі входу
  const toRegisterLink = loginForm.querySelector('.footer a[href="#"]');
  // Посилання "Увійти" в формі реєстрації
  const toLoginLink = registrationForm.querySelector('.footer a[href="#"]');

  if (toRegisterLink) {
    toRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.classList.remove('active-modal');
      registrationForm.classList.add('active-modal');
    });
  }

  if (toLoginLink) {
    toLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      registrationForm.classList.remove('active-modal');
      loginForm.classList.add('active-modal');
    });
  }
}

// Подія для кнопки "Увійти" на головній сторінці
document.addEventListener('DOMContentLoaded', () => {
  const loginButton = document.getElementById('login-button');
  if (loginButton) {
    loginButton.addEventListener('click', (e) => {
      e.preventDefault();
      loadLoginRegForm();
    });
  }
});
