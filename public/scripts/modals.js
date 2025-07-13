import { initTogglePassword } from "./toggle-password.js";

document.addEventListener("DOMContentLoaded", () => {
  const loginButton = document.getElementById("login-button");
  const addPostButton = document.getElementById("add-post-button");
  const modalContainer = document.getElementById("modal-container");

  // LOGIN / REGISTER MODAL
  loginButton?.addEventListener("click", async () => {
  if (!document.getElementById("login-reg-modal")) {
    const res = await fetch("/public/pages/components/login-reg-form/login-reg-form.html");
    const html = await res.text();
    modalContainer.innerHTML = html;

    const overlay = document.getElementById("modal-overlay");
    const modal = document.getElementById("login-reg-modal");
    const heading = modal.querySelector(".modal-heading");

    const loginForm = document.getElementById("login-form");
    const registrationForm = document.getElementById("registration-form");

    const regLink = loginForm.querySelector("a");
    const loginLink = registrationForm.querySelector("a");

    initTogglePassword();

    regLink.addEventListener("click", (e) => {
      e.preventDefault();
      heading.textContent = "Реєстрація";
      registrationForm.classList.add("active-modal");
      loginForm.classList.remove("active-modal");
    });

    loginLink.addEventListener("click", (e) => {
      e.preventDefault();
      heading.textContent = "Вхід";
      loginForm.classList.add("active-modal");
      registrationForm.classList.remove("active-modal");
    });

    overlay?.addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = loginForm.querySelector('input[name="email"]').value;
  const password = loginForm.querySelector('input[name="password"]').value;

  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const result = await response.json();

    if (response.ok) {
      // Успішний вхід
      localStorage.setItem("loggedIn", "true");
      // (опційно) Зберегти токен: localStorage.setItem("token", result.token);
      showAuthenticatedUI();
      closeModal();
    } else {
      alert(result.message || 'Невірний email або пароль');
    }
  } catch (err) {
    console.error('Помилка входу:', err);
    alert('Сервер недоступний. Спробуйте пізніше.');
  }
});


    registrationForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const fullName = registrationForm.querySelector('input[name="text"]').value;
      const email = registrationForm.querySelector('input[name="email"]').value;
      const password = registrationForm.querySelector('input[name="password"]').value;
      const selectedRole = registrationForm.querySelector('select[name="role"]').value;

      const roleMap = {
        vo: 'vo',
        mi: 'mi',
      };
      const roleId = roleMap[selectedRole] || selectedRole;

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
          registrationForm.reset();
          closeModal();
          //alert("Реєстрація успішна");
          localStorage.setItem("loggedIn", "true");
          showAuthenticatedUI();
        } else {
          alert(result.message || "Помилка реєстрації");
        }
      } catch (err) {
        console.error('Помилка при запиті:', err);
        alert('Сталася помилка. Спробуйте пізніше.');
      }
    });
  }

  showLoginModal();
});


  // ADD POST MODAL
  addPostButton?.addEventListener("click", async () => {
    if (!document.getElementById("post-modal")) {
      const res = await fetch("/public/pages/components/modal-forms/add-edit-post-form/add-edit-post.html");
      const html = await res.text();
      modalContainer.innerHTML = html;

      const overlay = document.getElementById("modal-overlay");
      const modal = document.getElementById("post-modal");

      overlay?.addEventListener("click", closeModal);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
      });
    }

    showAddEditPostModal("add");

    document.getElementById("add-post-form")?.classList.add("active-modal");
    document.getElementById("edit-post-form")?.classList.remove("active-modal");
  });

  // EDIT POST MODAL
  document.addEventListener("click", async (e) => {
  if (e.target.closest(".edit-post-button")) {

    if (!document.getElementById("post-modal")) {
      const res = await fetch("/public/pages/components/modal-forms/add-edit-post-form/add-edit-post.html");
      const html = await res.text();
      document.getElementById("modal-container").innerHTML = html;
    }

    showAddEditPostModal("edit");

    document.getElementById("add-post-form").classList.remove("active-modal");
    document.getElementById("edit-post-form").classList.add("active-modal");
  }
  });

  // EDIT PROFILE MODAL
  document.addEventListener("click", async (e) => {
  if (e.target.closest(".edit-profile-button")) {

    if (!document.getElementById("edit-profile-modal")) {
      const res = await fetch("/public/pages/components/modal-forms/edit-profile-form/edit-profile.html");
      const html = await res.text();
      document.getElementById("modal-container").innerHTML = html;
    }

    const overlay = document.getElementById("modal-overlay");
    const modal = document.getElementById("edit-profile-modal");
    overlay.classList.remove("hidden");
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");

    overlay?.addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }
  });

  // ANSWER REQUEST MODAL
  document.addEventListener("click", async (e) => {
  if (e.target.closest(".answer-request-button")) {

    if (!document.getElementById("answer-request-modal")) {
      const res = await fetch("/public/pages/components/modal-forms/answer-request-form/answer-request.html");
      const html = await res.text();
      document.getElementById("modal-container").innerHTML = html;
    }

    const overlay = document.getElementById("modal-overlay");
    const modal = document.getElementById("answer-request-modal");
    overlay.classList.remove("hidden");
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");

    overlay?.addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }
  });

  // UI based on login state
  if (localStorage.getItem("loggedIn") === "true") {
    showAuthenticatedUI();
  }

  const logoutButton = document.getElementById("logout-button");
  logoutButton?.addEventListener("click", () => {
    localStorage.removeItem("loggedIn");
    location.reload();
  });
});

// ----- Helper Functions -----

function showLoginModal() {
  const overlay = document.getElementById("modal-overlay");
  const modal = document.getElementById("login-reg-modal");
  const heading = modal?.querySelector(".modal-heading");

  const loginForm = document.getElementById("login-form");
  const registrationForm = document.getElementById("registration-form");

  heading.textContent = "Вхід";
  loginForm.classList.add("active-modal");
  registrationForm.classList.remove("active-modal");

  overlay.classList.remove("hidden");
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function showAddEditPostModal(mode = "add") {
  const overlay = document.getElementById("modal-overlay");
  const modal = document.getElementById("post-modal");
  const heading = modal?.querySelector(".modal-heading");
  
  heading.textContent = mode === "edit" ? "Редагувати допис" : "Створити допис";
  overlay.classList.remove("hidden");
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal() {
  document.getElementById("modal-overlay")?.classList.add("hidden");
  document.getElementById("login-reg-modal")?.classList.add("hidden");
  document.getElementById("post-modal")?.classList.add("hidden");
  document.getElementById("edit-profile-modal")?.classList.add("hidden");
  document.getElementById("answer-request-modal")?.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function showAuthenticatedUI() {
  const loginButton = document.getElementById("login-button");
  const addPostButton = document.getElementById("add-post-button");
  const profileButton = document.getElementById("profile-button");

  loginButton?.classList.add("hidden");
  addPostButton?.classList.remove("hidden");
  profileButton?.classList.remove("hidden");
}
