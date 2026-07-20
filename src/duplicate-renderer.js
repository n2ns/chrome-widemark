(function attachBookmarkDuplicateRenderer(root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.BookmarkDuplicateRenderer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createBookmarkDuplicateRendererApi() {
  const DELETE_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';

  function createEmptySection(documentRef, section, title, message) {
    section.innerHTML = '';

    const header = documentRef.createElement('div');
    header.className = 'duplicate-section-header';

    const titleEl = documentRef.createElement('span');
    titleEl.textContent = title;
    header.appendChild(titleEl);

    const messageEl = documentRef.createElement('div');
    messageEl.className = 'duplicate-empty-message';
    messageEl.textContent = message;

    section.appendChild(header);
    section.appendChild(messageEl);
  }

  function getOrCreateSection(documentRef, duplicateResults, id) {
    let section = documentRef.getElementById(id);
    if (!section) {
      section = documentRef.createElement('div');
      section.id = id;
      section.className = 'duplicate-section';
      duplicateResults.appendChild(section);
    }
    section.innerHTML = '';
    return section;
  }

  function createDuplicateRenderer({ documentRef = document, duplicateResults, handleBookmarkClick, restartDuplicateCheck, chromeApi, modalDialog }) {
    const chromeRuntime = chromeApi || chrome;

    function removeBookmark(id, item, callback) {
      chromeRuntime.bookmarks.remove(id, () => {
        if (chromeRuntime.runtime?.lastError) {
          if (modalDialog) {
            modalDialog.showInfoDialog({
              title: 'Unable to delete bookmark',
              message: chromeRuntime.runtime.lastError.message || `Could not delete "${item.title || '(No Title)'}".`,
              confirmLabel: 'OK'
            });
          }
          return;
        }

        callback();
      });
    }

    function renderDuplicates(duplicates, sectionLabel = 'Duplicates') {
      const dupSection = getOrCreateSection(documentRef, duplicateResults, 'dup-section');

      if (duplicates.length === 0) {
        createEmptySection(documentRef, dupSection, `${sectionLabel} (0)`, 'No duplicate bookmarks found.');
        return;
      }

      const header = documentRef.createElement('div');
      header.className = 'duplicate-section-header';

      const titleEl = documentRef.createElement('span');
      titleEl.textContent = `${sectionLabel} (${duplicates.length} groups)`;

      header.appendChild(titleEl);
      dupSection.appendChild(header);

      const list = documentRef.createElement('div');
      list.className = 'duplicate-list';
      dupSection.appendChild(list);

      duplicates.forEach(group => {
        const groupEl = documentRef.createElement('div');
        groupEl.className = 'duplicate-group';

        const groupHeader = documentRef.createElement('div');
        groupHeader.className = 'duplicate-group-header';

        const groupUrl = documentRef.createElement('span');
        groupUrl.className = 'duplicate-item-url';
        groupUrl.textContent = group.url;

        groupHeader.appendChild(groupUrl);
        groupEl.appendChild(groupHeader);

        const itemsContainer = documentRef.createElement('div');
        itemsContainer.className = 'duplicate-group-items';
        group.items.forEach(item => {
          const itemEl = documentRef.createElement('div');
          itemEl.className = 'duplicate-item';

          const itemContent = documentRef.createElement('div');
          itemContent.className = 'duplicate-item-content';

          const titleSpan = documentRef.createElement('span');
          titleSpan.className = 'duplicate-item-title';
          titleSpan.textContent = item.title || '(No Title)';
          titleSpan.title = item.url;

          const pathSpan = documentRef.createElement('span');
          pathSpan.className = 'duplicate-item-path';
          pathSpan.title = item.folderPath || 'Bookmarks';
          pathSpan.textContent = item.folderPath || 'Bookmarks';

          const deleteBtn = documentRef.createElement('button');
          deleteBtn.className = 'duplicate-btn-delete';
          deleteBtn.title = 'Delete';
          deleteBtn.innerHTML = DELETE_ICON;

          titleSpan.addEventListener('click', (event) => {
            handleBookmarkClick(item.url, event);
          });
          // Middle clicks fire 'auxclick', not 'click', in Chrome.
          titleSpan.addEventListener('auxclick', (event) => {
            if (event.button === 1) {
              handleBookmarkClick(item.url, event);
            }
          });
          deleteBtn.addEventListener('click', async () => {
            const confirmed = modalDialog
              ? await modalDialog.showConfirmDialog({
                title: 'Delete duplicate bookmark?',
                message: `Delete "${item.title || '(No Title)'}" from ${item.folderPath || 'Bookmarks'}?`,
                confirmLabel: 'Delete',
                cancelLabel: 'Cancel'
              })
              : true;

            if (!confirmed) return;
            removeBookmark(item.id, item, restartDuplicateCheck);
          });

          itemContent.appendChild(titleSpan);
          itemContent.appendChild(pathSpan);
          itemEl.appendChild(itemContent);
          itemEl.appendChild(deleteBtn);
          itemsContainer.appendChild(itemEl);
        });

        groupEl.appendChild(itemsContainer);
        list.appendChild(groupEl);
      });
    }

    return {
      renderDuplicates
    };
  }

  return {
    createDuplicateRenderer
  };
});
