(function attachWideMarkModalDialog(root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.WideMarkModalDialog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createWideMarkModalDialogApi() {
  function createModalDialog(documentRef = document) {
    let activeModalCancel = null;
    let selectedModalColor = '';
    let selectedModalIcon = 'default';

    documentRef.querySelectorAll('.color-badge').forEach(badge => {
      badge.addEventListener('click', () => {
        documentRef.querySelectorAll('.color-badge').forEach(b => b.classList.remove('selected'));
        badge.classList.add('selected');
        selectedModalColor = badge.dataset.color || '';
      });
    });

    documentRef.querySelectorAll('.icon-badge').forEach(badge => {
      badge.addEventListener('click', () => {
        documentRef.querySelectorAll('.icon-badge').forEach(b => b.classList.remove('selected'));
        badge.classList.add('selected');
        selectedModalIcon = badge.dataset.icon || 'default';
      });
    });

    function cancelActiveModal() {
      if (activeModalCancel) {
        activeModalCancel();
        return true;
      }

      const modal = documentRef.getElementById('custom-modal');
      if (modal && modal.style.display === 'flex') {
        modal.style.display = 'none';
        return true;
      }

      return false;
    }

    function showConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }) {
      return openCustomModal({
        title,
        message,
        mode: 'confirm',
        submitLabel: confirmLabel,
        cancelLabel
      });
    }

    function showInfoDialog({ title, message, confirmLabel = 'OK' }) {
      return openCustomModal({
        title,
        message,
        mode: 'alert',
        submitLabel: confirmLabel
      });
    }

    function openCustomModal({
      title,
      showFields = [],
      fieldsVal,
      confirmText,
      message,
      mode,
      submitLabel,
      cancelLabel,
      onSubmit
    }) {
      const modal = documentRef.getElementById('custom-modal');
      const modalTitle = documentRef.getElementById('modal-title');
      const fieldTitle = documentRef.getElementById('field-group-title');
      const fieldUrl = documentRef.getElementById('field-group-url');
      const inputTitle = documentRef.getElementById('modal-input-title');
      const inputUrl = documentRef.getElementById('modal-input-url');
      const modalFieldsContainer = documentRef.querySelector('.modal-fields');

      const oldMsg = documentRef.getElementById('modal-confirm-msg');
      if (oldMsg) oldMsg.remove();
      const oldError = documentRef.getElementById('modal-error-msg');
      if (oldError) oldError.remove();

      const dialogMode = mode || (confirmText || message ? 'confirm' : 'input');
      const dialogMessage = message || confirmText;

      modalTitle.textContent = title;

      fieldTitle.style.display = 'none';
      fieldUrl.style.display = 'none';
      const fieldFolderStyle = documentRef.getElementById('field-group-folder-style');
      if (fieldFolderStyle) fieldFolderStyle.style.display = 'none';

      const newInputTitle = inputTitle.cloneNode(true);
      const newInputUrl = inputUrl.cloneNode(true);
      inputTitle.replaceWith(newInputTitle);
      inputUrl.replaceWith(newInputUrl);

      if (dialogMessage) {
        const p = documentRef.createElement('p');
        p.id = 'modal-confirm-msg';
        p.className = 'modal-confirm-text';
        p.textContent = dialogMessage;
        modalFieldsContainer.appendChild(p);
      }

      if (dialogMode === 'input') {
        if (showFields.includes('title')) {
          fieldTitle.style.display = 'flex';
          newInputTitle.value = fieldsVal?.title || '';
        }
        if (showFields.includes('url')) {
          fieldUrl.style.display = 'flex';
          newInputUrl.value = fieldsVal?.url || '';
        }
        if (showFields.includes('folderStyle') && fieldFolderStyle) {
          fieldFolderStyle.style.display = 'block';
          selectedModalColor = fieldsVal?.color || '';
          selectedModalIcon = fieldsVal?.icon || 'default';

          modal.querySelectorAll('.color-badge').forEach(badge => {
            badge.classList.remove('selected');
            if ((badge.dataset.color || '') === selectedModalColor) {
              badge.classList.add('selected');
            }
          });

          modal.querySelectorAll('.icon-badge').forEach(badge => {
            badge.classList.remove('selected');
            if ((badge.dataset.icon || 'default') === selectedModalIcon) {
              badge.classList.add('selected');
            }
          });
        }
      }

      modal.style.display = 'flex';
      if (!confirmText && showFields.includes('title')) {
        newInputTitle.focus();
      }

      const submitBtn = documentRef.getElementById('modal-submit-btn');
      const cancelBtn = documentRef.getElementById('modal-cancel-btn');

      const newSubmitBtn = submitBtn.cloneNode(true);
      const newCancelBtn = cancelBtn.cloneNode(true);
      submitBtn.replaceWith(newSubmitBtn);
      cancelBtn.replaceWith(newCancelBtn);
      newSubmitBtn.textContent = submitLabel || (dialogMode === 'input' ? 'Save' : 'OK');
      newCancelBtn.textContent = cancelLabel || 'Cancel';
      newCancelBtn.style.display = dialogMode === 'alert' ? 'none' : 'inline-flex';

      function showModalError(messageText) {
        let errorEl = documentRef.getElementById('modal-error-msg');
        if (!errorEl) {
          errorEl = documentRef.createElement('p');
          errorEl.id = 'modal-error-msg';
          errorEl.className = 'modal-error-text';
          modalFieldsContainer.appendChild(errorEl);
        }
        errorEl.textContent = messageText;
      }

      const handleEnterSubmit = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          newSubmitBtn.click();
        }
      };
      newInputTitle.addEventListener('keydown', handleEnterSubmit);
      newInputUrl.addEventListener('keydown', handleEnterSubmit);

      return new Promise((resolve) => {
        let settled = false;

        function closeModal(result) {
          if (settled) return;
          settled = true;
          modal.style.display = 'none';
          if (activeModalCancel === cancelModal) {
            activeModalCancel = null;
          }
          resolve(result);
        }

        function cancelModal() {
          closeModal(false);
        }

        activeModalCancel = cancelModal;
        newCancelBtn.addEventListener('click', cancelModal);

        newSubmitBtn.addEventListener('click', () => {
          if (dialogMode === 'confirm' || dialogMode === 'alert') {
            if (onSubmit) onSubmit();
            closeModal(true);
            return;
          }

          if (showFields.includes('folderStyle')) {
            const data = { color: selectedModalColor, icon: selectedModalIcon };
            if (onSubmit) onSubmit(data);
            closeModal(data);
            return;
          }

          const titleVal = newInputTitle.value.trim();
          let urlVal = newInputUrl.value.trim();

          if (showFields.includes('title') && titleVal === '') {
            showModalError('Name cannot be empty.');
            return;
          }
          if (showFields.includes('url')) {
            if (urlVal === '') {
              showModalError('URL cannot be empty.');
              return;
            }
            if (!/^[a-zA-Z0-9+-.]+:\/\//.test(urlVal)) {
              urlVal = 'https://' + urlVal;
            }
          }

          const data = { title: titleVal, url: urlVal };
          if (onSubmit) onSubmit(data);
          closeModal(data);
        });
      });
    }

    return {
      openCustomModal,
      showConfirmDialog,
      showInfoDialog,
      cancelActiveModal
    };
  }

  return {
    createModalDialog
  };
});
