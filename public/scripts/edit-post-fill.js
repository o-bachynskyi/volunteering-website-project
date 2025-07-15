document.addEventListener('click', function (e) {
    const editButton = e.target.closest('.edit-post-button');
    if (!editButton) return;

    // Шукаємо контейнер поста
    const postArticle = editButton.closest('.post');
    if (!postArticle) return;

    // Затримка, щоб переконатись що модальне вікно вже з'явилось у DOM
    setTimeout(() => {
        try {
            // Отримання заголовку та опису поста
            const title = postArticle.querySelector('.post-title')?.textContent.trim() || '';
            const text = postArticle.querySelector('.post-description')?.textContent.trim() || '';

            // Припускаємо, що пост за замовчуванням має тип "fundraising"
            const typeSelect = document.querySelector('#edit-post-form select[name="type"]');
            typeSelect.value = "fundraising"; // або зробити логіку детекції, якщо треба

            // Заповнення заголовку та опису
            document.querySelector('#edit-post-form #post-title').value = title;
            document.querySelector('#edit-post-text').value = text;

            // Очищення контейнера зображень
            const imageContainer = document.querySelector('#edit-post-image-preview-container');
            imageContainer.innerHTML = '';

            // Додавання зображень з поста
            const postImages = postArticle.querySelectorAll('.post-photos img');
            postImages.forEach(img => {
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

        } catch (error) {
            console.error('Помилка при заповненні форми редагування поста:', error);
        }
    }, 50); // Невелика затримка після відкриття модального вікна
});