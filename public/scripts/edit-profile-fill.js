document.addEventListener('click', function (e) {
    // Якщо натиснута кнопка редагування профілю
    if (e.target.closest('#edit-profile-button')) {
        // Додати затримку, щоб переконатись, що DOM вже оновлено динамічно
        setTimeout(() => {
            try {
                const name = document.querySelector('.profile-name')?.textContent.trim() || '';
                const description = document.querySelector('.profile-description')?.textContent.trim() || '';
                const profileImage = document.querySelector('.profile-header img')?.src || '';

                document.getElementById('profile-title').value = name;
                document.getElementById('profile-text').value = description;
                document.querySelector('#edit-profile-form .profile-picture').src = profileImage;

                const modalTagsContainer = document.querySelector('#edit-profile-form #user-profile-tags');
                modalTagsContainer.innerHTML = '';

                const originalTags = document.querySelectorAll('.user-profile .profile-tag-title');
                originalTags.forEach(tag => {
                    const tagValue = tag.textContent.trim();

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
                    closeIcon.alt = 'Закрити';

                    closeBtn.appendChild(closeIcon);
                    tagEl.appendChild(tagTitle);
                    tagEl.appendChild(closeBtn);

                    modalTagsContainer.appendChild(tagEl);
                });
            } catch (error) {
                console.error('Помилка при заповненні форми редагування профілю:', error);
            }
        }, 50); // 50 мс — достатньо для більшості випадків
    }
})