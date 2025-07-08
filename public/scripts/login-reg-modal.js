import { initTogglePassword } from "./toggle-password.js";

document.addEventListener("DOMContentLoaded", () => {
  const loginButton = document.getElementById("login-button");
  const modalContainer = document.getElementById("modal-container");

  if (!loginButton || !modalContainer) return;

  loginButton.addEventListener("click", async () => {
    // Only fetch once
    if (!modalContainer.innerHTML.trim()) {
      const res = await fetch("/public/pages/components/login-reg-form/login-reg-form.html");
      const html = await res.text();
      modalContainer.innerHTML = html;

      // Add close logic after content is injected
      const overlay = document.getElementById("modal-overlay");
      const modal = document.getElementById("login-reg-modal");
      const heading = modal.querySelector(".modal-heading");
      const loginForm = document.getElementById("login-form");
      const registrationForm = document.getElementById("registration-form");
      const regLink = loginForm.querySelector("a");
      const loginLink = registrationForm.querySelector("a");
      // Initialize toggle button
      initTogglePassword();

      regLink.addEventListener("click", (e) => {
        e.preventDefault();
        heading.textContent = "Реєстрація";
        registrationForm.classList.add("active");
        loginForm.classList.remove("active");
      });

      loginLink.addEventListener("click", (e) => {
        e.preventDefault();
        heading.textContent = "Вхід";
        loginForm.classList.add("active");
        registrationForm.classList.remove("active");
      });

      const closeModal = () => {
      overlay?.classList.add("hidden");
      modal?.classList.add("hidden");
      document.body.classList.remove("modal-open");
    };

    overlay?.addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  // Always open login form when clicking login button
    const modal = document.getElementById("login-reg-modal");
    const overlay = document.getElementById("modal-overlay");
    const heading = modal.querySelector(".modal-heading");

    const loginForm = document.getElementById("login-form");
    const registrationForm = document.getElementById("registration-form");

    heading.textContent = "Вхід";
    loginForm.classList.add("active");
    registrationForm.classList.remove("active");

    overlay.classList.remove("hidden");
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  });
});