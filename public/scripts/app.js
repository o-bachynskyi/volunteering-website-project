const searchForm = document.querySelector('.search-form');
const searchInput = document.querySelector('.search-input');
const tagsContainer = document.querySelector('.tags-container');
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/webp',
  'image/bmp',
]);
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_POST_IMAGE_COUNT = 5;
let resolvedImageUploadMessage = '';

function normalizeSearchText(value = '') {
  return value == null ? '' : String(value).trim().toLowerCase();
}

function getSearchTags() {
  return Array.from(document.querySelectorAll('.tags-list .tag-title'))
    .map((tag) => normalizeSearchText(tag.textContent))
    .filter(Boolean);
}

function getSearchState() {
  return {
    query: normalizeSearchText(searchInput?.value || ''),
    tags: getSearchTags(),
  };
}

function dispatchSearchChange() {
  document.dispatchEvent(new CustomEvent('search:changed', {
    detail: getSearchState(),
  }));
}

window.SearchState = {
  getState: getSearchState,
};

function setImageUploadError(form, message = '') {
  const errorElement = form?.querySelector('.image-upload-error');
  if (!errorElement) return;

  const nextMessage = message
    ? (resolvedImageUploadMessage || message)
    : '';

  errorElement.textContent = nextMessage;
  errorElement.classList.toggle('hidden', !nextMessage);
}

function getImageUploadErrorMessage(file) {
  if (file.type?.startsWith('video/')) {
    return 'Можна додавати лише фото. Відео для дописів не підтримуються.';
  }

  if (file.type === 'image/gif') {
    return 'Гіфки для дописів не підтримуються. Додайте фото у форматі JPG, JPEG, PNG, WEBP або BMP.';
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'Можна додавати лише фото у форматі JPG, JPEG, PNG, WEBP або BMP.';
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'Розмір одного фото не може перевищувати 8 МБ.';
  }

  return '';
}

function isLoggedIn() {
  return Boolean(window.AuthState?.isLoggedIn());
}

function openLoginPrompt() {
  document.getElementById('login-button')?.click();
}

function syncGuestUiState() {
  document.body.classList.toggle('guest-user', !isLoggedIn());
}

// Show on focus
searchInput.addEventListener('focus', () => {
  tagsContainer.classList.remove('hidden');
});

searchInput.addEventListener('input', () => {
  dispatchSearchChange();
});

searchForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  dispatchSearchChange();
});

// Hide when focus leaves both the input AND the tagsContainer
document.addEventListener('click', (e) => {
  if (
    !searchInput.contains(e.target) &&
    !tagsContainer.contains(e.target)
  ) {
    tagsContainer.classList.add('hidden');
  }
});

// Collapse Sidebar

const collapseBtn = document.getElementById('collapse-button');
const sidebar = document.querySelector('.sidebar');
const icon = document.getElementById('collapse-icon');

collapseBtn.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  icon.classList.toggle('rotated');
});

// Profile Dropdown

const profileButton = document.getElementById('profile-button')
const profileDropdown = document.getElementById('profile-dropdown')

// Toggle dropdown on click
profileButton.addEventListener('click', (e) => {
  e.stopPropagation();
  profileDropdown.classList.toggle('hidden');
});

// Prevent clicks inside dropdown from closing it
profileDropdown.addEventListener('click', (e) => {
  e.stopPropagation();
});

// Hide dropdown when clicking outside
document.addEventListener('click', () => {
  profileDropdown.classList.add('hidden');
});

//
// Close Modal Button
//

document.addEventListener('click', (e) => {
  const authRequiredTarget = e.target.closest(
    '.answer-request-button, .post-more-button, .edit-post-button, .close-request-button, .delete-own-post-button, .delete-accepted-request-button, .edit-profile-button, .view-report-button, .export-report-button'
  );

  if (authRequiredTarget && !isLoggedIn()) {
    e.preventDefault();
    e.stopImmediatePropagation();
    openLoginPrompt();
    return;
  }

  const closeBtn = e.target.closest('.close-modal-button');
  if (closeBtn) {
    const modal = closeBtn.closest('.modal-window, .post-modal-window, .edit-profile-modal-window, .answer-request-modal-window, .report-modal-window');
    const overlay = document.getElementById('modal-overlay');
    if (modal) {
      modal.classList.add('hidden');

      // Clear all inputs, textareas, and selects inside this modal
      modal.querySelectorAll('input, textarea, select').forEach(el => {
        if (el.type === 'checkbox' || el.type === 'radio') {
          el.checked = false;
        } else if (el.tagName.toLowerCase() === 'select') {
          el.selectedIndex = 0; // reset to first option
        } else {
          el.value = '';
        }
      });
      // 2. Clear tags (like #user-post-tags)
      const tags = modal.querySelector('#user-post-tags');
      if (tags) tags.innerHTML = '';

      // 3. Clear image preview container
      const images = modal.querySelector('#post-image-preview-container, #answer-image-preview-container, #report-image-preview-container');
      if (images) images.innerHTML = '';
    }
    if (overlay) overlay.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }
});

//
// Profile Post More Dropdown
//

// Select all post more buttons and dropdowns
document.addEventListener('click', (e) => {
  const moreBtn = e.target.closest('.post-more-button');
  const insideDropdown = e.target.closest('.post-more-dropdown');

  if (moreBtn) {
    e.stopPropagation();

    // Close all other dropdowns
    document.querySelectorAll('.post-more-dropdown').forEach(drop => {
      drop.classList.add('hidden');
    });

    // Toggle the one next to the clicked button
    const dropdown = moreBtn.nextElementSibling;
    if (dropdown?.classList.contains('post-more-dropdown')) {
      dropdown.classList.toggle('hidden');
    }

    return; // Skip rest of handler
  }

  // Don't close if click was inside the dropdown
  if (insideDropdown && e.target.closest('button')) {
    document.querySelectorAll('.post-more-dropdown').forEach(dropdown => {
      dropdown.classList.add('hidden');
    });
    return;
  }

  // Clicked outside — close all dropdowns
  document.querySelectorAll('.post-more-dropdown').forEach(dropdown => {
    dropdown.classList.add('hidden');
  });
});

// Deleting Tags
document.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('.close');

  if (closeBtn && closeBtn.closest('.profile-tag, .post-tag, .tag')) {
    const tagElement = closeBtn.closest('.profile-tag, .post-tag, .tag');
    tagElement.remove(); // Remove tag from DOM

    if (tagElement.classList.contains('tag')) {
      dispatchSearchChange();
    }
  }
});

// Adding Images (Add/Edit Post, Answer Request)
document.addEventListener('change', function (e) {
  const input = e.target;

  // Make sure it's the correct input
  if (
    input.matches('input[type="file"].image-upload') &&
    input.files.length > 0
  ) {
    const files = input.files;
    const form = input.closest("form");
    const imageContainer = form.querySelector(".image-container");
    const existingImageCount = imageContainer.querySelectorAll('.added-image').length;
    let remainingSlots = Math.max(0, MAX_POST_IMAGE_COUNT - existingImageCount);
    let overLimitCount = 0;
    resolvedImageUploadMessage = '';
    setImageUploadError(form, '');
    let firstErrorMessage = '';
    let hasVideoFile = false;
    let hasGifFile = false;
    let hasUnsupportedImageFile = false;
    let hasOversizeFile = false;

    if (files.length > remainingSlots) {
      resolvedImageUploadMessage = `Можна додати не більше ${MAX_POST_IMAGE_COUNT} фото до одного допису.`;
      setImageUploadError(form, resolvedImageUploadMessage);
      input.value = "";
      return;
    }

    Array.from(files).forEach(file => {
      const validationMessage = getImageUploadErrorMessage(file);
      if (validationMessage) {
        hasVideoFile ||= Boolean(file.type?.startsWith('video/'));
        hasGifFile ||= file.type === 'image/gif';
        hasUnsupportedImageFile ||= Boolean(
          file.type &&
          !file.type.startsWith('video/') &&
          file.type !== 'image/gif' &&
          !ALLOWED_IMAGE_TYPES.has(file.type)
        );
        hasOversizeFile ||= file.size > MAX_IMAGE_SIZE_BYTES;
        firstErrorMessage ||= validationMessage;
        return;
      }

      const reader = new FileReader();
      reader.onload = function (e) {
        const imgSrc = e.target.result;

        const imageWrapper = document.createElement("button");
        imageWrapper.setAttribute("type", "button");
        imageWrapper.classList.add("remove-image-button");
        imageWrapper.setAttribute("aria-label", "Видалити");

        imageWrapper.innerHTML = `
          <div class="remove-image-overlay"></div>
          <img src="/public/images/close-icon.png" class="remove-image-icon" alt="remove image">
          <img src="${imgSrc}" class="added-image" alt="added-image">
        `;

        imageWrapper.addEventListener('click', () => {
          imageWrapper.remove();
          resolvedImageUploadMessage = '';
          setImageUploadError(form, '');
        });

        imageContainer.appendChild(imageWrapper);
      };

      reader.readAsDataURL(file);
      remainingSlots -= 1;
    });

    resolvedImageUploadMessage = firstErrorMessage || '';

    resolvedImageUploadMessage = hasVideoFile
      ? 'Можна додавати лише фото. Відео для дописів не підтримуються.'
      : hasGifFile
        ? 'Гіфки для дописів не підтримуються. Додайте фото у форматі JPG, JPEG, PNG, WEBP або BMP.'
        : hasUnsupportedImageFile
          ? 'Можна додавати лише фото у форматі JPG, JPEG, PNG, WEBP або BMP.'
          : hasOversizeFile
            ? 'Розмір одного фото не може перевищувати 8 МБ.'
            : resolvedImageUploadMessage;

    setImageUploadError(form, resolvedImageUploadMessage);

    // Reset input so same image can be selected again
    input.value = "";
  }
});

// Deleting Post/Answer Images
document.addEventListener('click', (e) => {
  const removeBtn = e.target.closest('.remove-image-button');

  if (removeBtn) {
    removeBtn.remove(); // Remove tag from DOM
  }
});

function createPostTagElement(tagValue) {
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

  return tagEl;
}

function createSearchTagElement(tagValue) {
  const tagEl = document.createElement('div');
  tagEl.classList.add('tag');

  const tagTitle = document.createElement('p');
  tagTitle.classList.add('tag-title');
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

  return tagEl;
}

function createProfileTagElement(tagValue) {
  const tagEl = document.createElement('div');
  tagEl.classList.add('profile-tag');

  const tagTitle = document.createElement('p');
  tagTitle.classList.add('profile-tag-title');
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

  return tagEl;
}

function addTagToContainer(input, tagsContainer, createTagElement) {
  const tagValue = input.value.trim();
  if (!tagValue) return;

  const exists = Array.from(tagsContainer.querySelectorAll('.post-tag-title, .profile-tag-title, .tag-title'))
    .some(tag => tag.textContent.trim().toLowerCase() === tagValue.toLowerCase());

  if (exists) {
    input.value = '';
    return;
  }

  tagsContainer.appendChild(createTagElement(tagValue));
  input.value = '';
}

function addPostTagFromInput(input) {
  const form = input.closest('form');
  const tagsContainer = form?.querySelector('.post-tags');
  if (!form || !tagsContainer) return;

  addTagToContainer(input, tagsContainer, createPostTagElement);
}

function addSearchTagFromInput(input) {
  const tagsContainer = document.querySelector('.tags-list');
  if (!tagsContainer) return;

  addTagToContainer(input, tagsContainer, createSearchTagElement);
  dispatchSearchChange();
}

function addProfileTagFromInput(input) {
  const form = input.closest('form');
  const tagsContainer = form?.querySelector('#user-profile-tags');
  if (!form || !tagsContainer) return;

  addTagToContainer(input, tagsContainer, createProfileTagElement);
}

document.addEventListener('click', (e) => {
  const addTagButton = e.target.closest('.add-tag-button');
  if (addTagButton) {
    const input = addTagButton.closest('.post-tags-entry-row')?.querySelector('input[name="post-tags"]');
    if (input) {
      addPostTagFromInput(input);
      input.focus();
    }
    return;
  }

  const addProfileTagButton = e.target.closest('.add-profile-tag-button');
  if (addProfileTagButton) {
    const input = addProfileTagButton.closest('.profile-tags-entry-row')?.querySelector('#profile-tags');
    if (input) {
      addProfileTagFromInput(input);
      input.focus();
    }
    return;
  }

  const searchAddTagButton = e.target.closest('.search-add-tag-button');
  if (!searchAddTagButton) return;

  const input = searchAddTagButton.closest('.tags-input-wrapper')?.querySelector('.tags-input');
  if (input) {
    addSearchTagFromInput(input);
    input.focus();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;

  const postTagInput = e.target.closest('input[name="post-tags"]');
  if (postTagInput) {
    e.preventDefault();
    addPostTagFromInput(postTagInput);
    return;
  }

  const searchTagInput = e.target.closest('.tags-input');
  if (searchTagInput) {
    e.preventDefault();
    addSearchTagFromInput(searchTagInput);
    return;
  }

  const profileTagInput = e.target.closest('#profile-tags');
  if (profileTagInput) {
    e.preventDefault();
    addProfileTagFromInput(profileTagInput);
  }
});

function validatePassword() {
  const password = document.getElementById("password-registration");
  const confirm = document.getElementById("password-confirmation");

  if (confirm.value !== password.value) {
    confirm.setCustomValidity("Паролі не збігаються");
  } else {
    confirm.setCustomValidity(""); // Clear the error to allow submission
  }
}

syncGuestUiState();
document.addEventListener('auth:changed', syncGuestUiState);
document.addEventListener('page:loaded', syncGuestUiState);
document.addEventListener('page:loaded', dispatchSearchChange);
