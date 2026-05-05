function escapeHtml(text = '') {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('#edit-profile-button')) {
    return;
  }

  setTimeout(() => {
    try {
      const user = window.AuthState?.getUser();
      const form = document.getElementById('edit-profile-form');
      if (!user || !form) {
        return;
      }

      const nameInput = document.getElementById('profile-title');
      const descriptionInput = document.getElementById('profile-text');
      const image = form.querySelector('.profile-picture');
      const tagsContainer = form.querySelector('#user-profile-tags');
      const tagInput = form.querySelector('#profile-tags');
      const imageInput = document.getElementById('profile-image-upload');

      if (nameInput) {
        nameInput.value = user.full_name || '';
      }

      if (descriptionInput) {
        descriptionInput.value = user.description || '';
        descriptionInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (image) {
        image.src = user.image_url || '/public/images/account-icon.png';
      }

      if (imageInput) {
        imageInput.value = '';
      }

      if (tagInput) {
        tagInput.value = '';
      }

      if (tagsContainer) {
        tagsContainer.innerHTML = (user.tags || []).map((tagValue) => `
          <div class="profile-tag">
            <p class="profile-tag-title">${escapeHtml(tagValue)}</p>
            <button type="button" class="close">
              <img src="/public/images/close-icon.png" alt="Закрити">
            </button>
          </div>
        `).join('');
      }
    } catch (error) {
      console.error('Помилка при заповненні форми редагування профілю:', error);
    }
  }, 50);
});
