document.addEventListener('DOMContentLoaded', () => {
  const autoResize = (el) => {
    el.style.height = 'auto'; // Reset height
    el.style.height = el.scrollHeight + 'px'; // Adjust to content
  };

  // Delegate input events on any element with id="post-text"
  document.addEventListener('input', (e) => {
    if (e.target.matches('#add-post-text, #add-post-text, #profile-text, #answer-text')) {
      autoResize(e.target);
    }
  });

  // Optional: initial resize if textarea is already in DOM on load
  document.addEventListener('click', (e) => {
    // При відкритті профілю
    if (e.target.closest('#edit-profile-button')) {
      setTimeout(() => {
        const profileTextarea = document.getElementById('profile-text');
        if (profileTextarea) autoResize(profileTextarea);
      }, 50);
    }

    // При відкритті редагування поста
    if (e.target.closest('.edit-post-button')) {
      setTimeout(() => {
        const editPostTextarea = document.getElementById('edit-post-text');
        if (editPostTextarea) autoResize(editPostTextarea);
      }, 50);
    }
  });
});