(function attachBookmarkDuplicateRenderer(root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.BookmarkDuplicateRenderer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createBookmarkDuplicateRendererApi() {
  const DELETE_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';

  function createEmptySection(section, title, message) {
    section.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'duplicate-section-header';

    const titleEl = document.createElement('span');
    titleEl.textContent = title;
    header.appendChild(titleEl);

    const messageEl = document.createElement('div');
    messageEl.style.fontSize = '0.75rem';
    messageEl.style.color = 'var(--text-muted)';
    messageEl.style.padding = '4px 8px';
    messageEl.textContent = message;

    section.appendChild(header);
    section.appendChild(messageEl);
  }

  function getOrCreateSection(duplicateResults, id) {
    let section = document.getElementById(id);
    if (!section) {
      section = document.createElement('div');
      section.id = id;
      section.className = 'duplicate-section';
      duplicateResults.appendChild(section);
    }
    section.innerHTML = '';
    return section;
  }

  function createDuplicateRenderer({ duplicateResults, handleBookmarkClick, restartDuplicateCheck, chromeApi, modalDialog }) {
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

    function renderDuplicates(duplicates) {
      const dupSection = getOrCreateSection(duplicateResults, 'dup-section');

      if (duplicates.length === 0) {
        createEmptySection(dupSection, 'Duplicates (0)', 'No duplicate bookmarks found.');
        return;
      }

      const header = document.createElement('div');
      header.className = 'duplicate-section-header';

      const titleEl = document.createElement('span');
      titleEl.textContent = `Duplicates (${duplicates.length} groups)`;

      header.appendChild(titleEl);
      dupSection.appendChild(header);

      const list = document.createElement('div');
      list.className = 'duplicate-list';
      dupSection.appendChild(list);

      duplicates.forEach(group => {
        const groupEl = document.createElement('div');
        groupEl.className = 'duplicate-group';

        const groupHeader = document.createElement('div');
        groupHeader.className = 'duplicate-group-header';

        const groupUrl = document.createElement('span');
        groupUrl.className = 'duplicate-item-url';
        groupUrl.textContent = group.url;

        groupHeader.appendChild(groupUrl);
        groupEl.appendChild(groupHeader);

        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'duplicate-group-items';
        group.items.forEach(item => {
          const itemEl = document.createElement('div');
          itemEl.className = 'duplicate-item';

          const itemContent = document.createElement('div');
          itemContent.className = 'duplicate-item-content';

          const titleSpan = document.createElement('span');
          titleSpan.className = 'duplicate-item-title';
          titleSpan.style.cursor = 'pointer';
          titleSpan.style.textDecoration = 'none';
          titleSpan.textContent = item.title || '(No Title)';
          titleSpan.title = item.url;

          const pathSpan = document.createElement('span');
          pathSpan.className = 'duplicate-item-path';
          pathSpan.title = item.folderPath || 'Bookmarks';
          pathSpan.textContent = item.folderPath || 'Bookmarks';

          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'duplicate-btn-delete';
          deleteBtn.title = 'Delete';
          deleteBtn.innerHTML = DELETE_ICON;

          titleSpan.addEventListener('click', (event) => {
            handleBookmarkClick(item.url, event);
          });
          titleSpan.addEventListener('mouseenter', () => {
            titleSpan.style.textDecoration = 'underline';
            titleSpan.style.color = 'var(--accent)';
          });
          titleSpan.addEventListener('mouseleave', () => {
            titleSpan.style.textDecoration = 'none';
            titleSpan.style.color = '';
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
