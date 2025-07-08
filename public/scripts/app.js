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
