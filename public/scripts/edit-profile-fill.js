function escapeHtml(text = '') {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getDefaultProfileImage(user) {
  return user?.role_code === 'mi'
    ? '/public/images/account-icon.png'
    : '/public/images/premium_photo-1689568126014-06fea9d5d341.jpg';
}

function isAllowedProfileImageType(file) {
  return [
    'image/jpeg',
    'image/jpg',
    'image/pjpeg',
    'image/png',
    'image/x-png',
    'image/webp',
    'image/bmp',
  ].includes(file?.type);
}

function wireProfileImageControls(form, user) {
  const image = form.querySelector('.profile-picture');
  const imageInput = form.querySelector('#profile-image-upload');
  const deleteButton = form.querySelector('.delete-profile-picture');

  if (!image || !imageInput || !deleteButton) {
    return;
  }

  const fallbackImage = getDefaultProfileImage(user);

  imageInput.onchange = () => {
    const [file] = imageInput.files || [];
    if (!file) {
      return;
    }

    if (!isAllowedProfileImageType(file)) {
      if (file.type?.startsWith('video/')) {
        alert('Для аватара можна використовувати лише фото. Відео не підтримуються.');
      } else if (file.type === 'image/gif') {
        alert('Гіфки для аватара не підтримуються. Додайте звичайне фото.');
      } else {
        alert('Для аватара можна використовувати лише фото у форматі JPG, JPEG, PNG, WEBP або BMP.');
      }
      imageInput.value = '';
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert('Фото профілю має бути не більше 8 МБ.');
      imageInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      image.src = event.target?.result || fallbackImage;
    };
    reader.readAsDataURL(file);
  };

  deleteButton.onclick = () => {
    image.src = fallbackImage;
    imageInput.value = '';
  };
}

function fillEditProfileForm() {
  try {
    const user = window.AuthState?.getUser?.();
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
    const fallbackImage = getDefaultProfileImage(user);

    if (nameInput) {
      nameInput.value = user.full_name || '';
    }

    if (descriptionInput) {
      descriptionInput.value = user.description || '';
      descriptionInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (image) {
      image.src = user.image_url || fallbackImage;
    }

    if (imageInput) {
      imageInput.value = '';
    }

    wireProfileImageControls(form, user);

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
}

document.addEventListener('edit-profile:open', () => {
  fillEditProfileForm();
});

window.EditProfileFill = {
  fill: fillEditProfileForm,
};
