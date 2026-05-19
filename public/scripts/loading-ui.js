(function attachLoadingUi() {
  const FORM_LOADING_TEXT = {
    'login-form': 'Входимо...',
    'registration-form': 'Реєструємо...',
    'add-post-form': 'Створюємо...',
    'edit-post-form': 'Зберігаємо...',
    'edit-profile-form': 'Зберігаємо...',
    'answer-request-form': 'Надсилаємо...',
    'request-report-form': 'Надсилаємо...',
  };

  function showSectionLoader(container, message = 'Завантаження...') {
    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="loading-block" role="status" aria-live="polite">
        <div class="loading-spinner" aria-hidden="true"></div>
        <p class="loading-text">${message}</p>
      </div>
    `;
  }

  function setButtonLoading(button, isLoading, loadingText = 'Завантаження...') {
    if (!button) {
      return;
    }

    if (isLoading) {
      if (!button.dataset.originalHtml) {
        button.dataset.originalHtml = button.innerHTML;
      }

      button.disabled = true;
      button.classList.add('is-loading');
      button.innerHTML = `
        <span class="button-spinner" aria-hidden="true"></span>
        <span>${loadingText}</span>
      `;
      return;
    }

    button.disabled = false;
    button.classList.remove('is-loading');

    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }

  function clearAllLoadingButtons() {
    document.querySelectorAll('.is-loading').forEach((button) => {
      setButtonLoading(button, false);
    });
  }

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('form');
    if (!form) {
      return;
    }

    const loadingText = FORM_LOADING_TEXT[form.id];
    const submitButton = form.querySelector('.submit-button');
    if (!loadingText || !submitButton) {
      return;
    }

    setButtonLoading(submitButton, true, loadingText);
  }, true);

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    try {
      return await nativeFetch(...args);
    } finally {
      queueMicrotask(clearAllLoadingButtons);
    }
  };

  window.LoadingUi = {
    showSectionLoader,
    setButtonLoading,
    clearAllLoadingButtons,
  };
})();
