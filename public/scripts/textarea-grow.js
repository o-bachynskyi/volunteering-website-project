document.addEventListener('DOMContentLoaded', () => {
  const autoResize = (el) => {
    el.style.height = 'auto'; // Reset height
    el.style.height = el.scrollHeight + 'px'; // Adjust to content
  };

  // Delegate input events on any element with id="post-text"
  document.addEventListener('input', (e) => {
    if (e.target.matches('#post-text, #profile-text, #answer-text')) {
      autoResize(e.target);
    }
  });

  // Optional: initial resize if textarea is already in DOM on load
  const existingTextarea = document.getElementById('post-text, profile-text, answer-text');
  if (existingTextarea) {
    autoResize(existingTextarea);
  }
});