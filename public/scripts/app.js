const searchInput = document.querySelector('.search-input');
const tagsContainer = document.querySelector('.tags-container');

// Show on focus
searchInput.addEventListener('focus', () => {
  tagsContainer.classList.remove('hidden');
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
  const closeBtn = e.target.closest('.close-modal-button');
  if (closeBtn) {
    const modal = closeBtn.closest('.modal-window, .post-modal-window, .edit-profile-modal-window, .answer-request-modal-window');
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
      const images = modal.querySelector('#post-image-preview-container, #answer-image-preview-container');
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

    Array.from(files).forEach(file => {
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
        });

        imageContainer.appendChild(imageWrapper);
      };

      reader.readAsDataURL(file);
    });

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

