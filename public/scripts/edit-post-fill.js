(function attachEditPostFill() {
  function fillEditPostFormFromArticle(postArticle) {
    if (!postArticle) return;

    try {
      const editForm = document.getElementById('edit-post-form');
      if (!editForm) return;

      const title = postArticle.querySelector('.post-title')?.textContent.trim() || '';
      const text = postArticle.querySelector('.post-description')?.textContent.trim() || '';
      const tags = Array.from(postArticle.querySelectorAll('.profile-tag-title, .post-tag-title'))
        .map((tag) => tag.textContent.trim())
        .filter(Boolean);

      editForm.dataset.postId = postArticle.dataset.ownedPostId || postArticle.dataset.requestId || '';

      const typeSelect = editForm.querySelector('select[name="type"]');
      if (typeSelect) {
        typeSelect.value = postArticle.dataset.requestId ? 'request' : 'fundraising';
      }

      const titleInput = editForm.querySelector('input[name="post-title"]');
      if (titleInput) {
        titleInput.value = title;
      }

      const textInput = document.getElementById('edit-post-text');
      if (textInput) {
        textInput.value = text;
      }

      const editTagsContainer = editForm.querySelector('#user-post-tags');
      if (editTagsContainer) {
        editTagsContainer.innerHTML = '';

        tags.forEach((tagValue) => {
          const tagEl = document.createElement('div');
          tagEl.classList.add('post-tag');

          const tagTitle = document.createElement('p');
          tagTitle.classList.add('post-tag-title');
          tagTitle.textContent = tagValue;

          const closeBtn = document.createElement('button');
          closeBtn.type = 'button';
          closeBtn.classList.add('close');

          const closeIcon = document.createElement('img');
          closeIcon.src = '/public/images/close-icon.png';
          closeIcon.alt = 'Видалити тег';

          closeBtn.appendChild(closeIcon);
          tagEl.appendChild(tagTitle);
          tagEl.appendChild(closeBtn);
          editTagsContainer.appendChild(tagEl);
        });
      }

      const imageContainer = document.getElementById('edit-post-image-preview-container');
      if (imageContainer) {
        imageContainer.innerHTML = '';

        const postImages = postArticle.querySelectorAll('.post-photos img');
        postImages.forEach((img) => {
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
  }

  window.EditPostFill = {
    fillFromPost: fillEditPostFormFromArticle,
  };
})();
