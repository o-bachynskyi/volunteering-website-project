function escapeHtml(text = '') {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

document.addEventListener('click', (event) => {
  const editButton = event.target.closest('.edit-post-button');
  if (!editButton) return;

  const postArticle = editButton.closest('.post');
  if (!postArticle) return;

  setTimeout(() => {
    try {
      const form = document.getElementById('edit-post-form');
      if (!form) {
        return;
      }

      const title = postArticle.querySelector('.post-title')?.textContent.trim() || '';
      const text = postArticle.querySelector('.post-description')?.textContent.trim() || '';
      const tags = Array.from(postArticle.querySelectorAll('.profile-tag-title, .post-tag-title'))
        .map((tag) => tag.textContent.trim())
        .filter(Boolean);

      const postId = postArticle.dataset.ownedPostId || postArticle.dataset.requestId || '';
      const typeSelect = form.querySelector('select[name="type"]');
      const titleInput = form.querySelector('input[name="post-title"]');
      const textInput = form.querySelector('#edit-post-text');
      const editTagsContainer = form.querySelector('#user-post-tags');
      const imageContainer = form.querySelector('#edit-post-image-preview-container');

      form.dataset.postId = postId;

      if (typeSelect) {
        typeSelect.value = postArticle.dataset.requestId ? 'request' : 'fundraising';
      }

      if (titleInput) {
        titleInput.value = title;
      }

      if (textInput) {
        textInput.value = text;
        textInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (editTagsContainer) {
        editTagsContainer.innerHTML = tags.map((tagValue) => `
          <div class="post-tag">
            <p class="post-tag-title">${escapeHtml(tagValue)}</p>
            <button type="button" class="close">
              <img src="/public/images/close-icon.png" alt="Видалити тег">
            </button>
          </div>
        `).join('');
      }

      if (imageContainer) {
        imageContainer.innerHTML = '';
        postArticle.querySelectorAll('.post-photos img').forEach((img) => {
          const wrapper = document.createElement('button');
          wrapper.type = 'button';
          wrapper.classList.add('remove-image-button');
          wrapper.setAttribute('aria-label', 'Видалити');
          wrapper.innerHTML = `
            <div class="remove-image-overlay"></div>
            <img src="/public/images/close-icon.png" class="remove-image-icon" alt="remove image">
            <img src="${img.src}" class="added-image" alt="added-image">
          `;
          imageContainer.appendChild(wrapper);
        });
      }
    } catch (error) {
      console.error('Помилка при заповненні форми редагування поста:', error);
    }
  }, 50);
});
