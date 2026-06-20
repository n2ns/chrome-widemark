(function attachWideMarkDuplicateFinder(root, factory) {
  const api = factory(root);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.WideMarkDuplicateFinder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createWideMarkDuplicateFinderApi(root) {
  function gatherAllBookmarks(nodes, bookmarksList = [], folderPath = []) {
    nodes.forEach(node => {
      if (node.url) {
        bookmarksList.push({
          ...node,
          folderPath: folderPath.length > 0 ? folderPath.join(' / ') : 'Bookmarks'
        });
      } else if (node.children) {
        const nextPath = node.title
          ? [...folderPath, node.title]
          : folderPath;
        gatherAllBookmarks(node.children, bookmarksList, nextPath);
      }
    });
    return bookmarksList;
  }

  function renderNoDuplicates(duplicateResults) {
    duplicateResults.innerHTML = `
      <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="var(--text-secondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 8px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        <div style="font-weight: 600; font-size: 0.9rem;">No duplicate bookmarks found.</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">This duplicate check only checks local bookmark URLs and does not contact websites.</div>
      </div>
    `;
  }

  function createDuplicateFinderController({
    document,
    chromeApi,
    findDuplicateBookmarks,
    handleBookmarkClick,
    modalDialog,
    reportChromeError
  }) {
    const startDuplicateCheckBtn = document.getElementById('find-duplicates-btn');
    const duplicateProgressContainer = document.getElementById('duplicate-progress-container');
    const duplicateProgressBar = document.getElementById('duplicate-progress-bar');
    const duplicateProgressText = document.getElementById('duplicate-progress-text');
    const duplicateResults = document.getElementById('duplicate-results');
    const { renderDuplicates } = root.BookmarkDuplicateRenderer.createDuplicateRenderer({
      duplicateResults,
      handleBookmarkClick,
      restartDuplicateCheck: () => startDuplicateCheck(),
      chromeApi,
      modalDialog
    });

    function resetProgress() {
      startDuplicateCheckBtn.style.display = 'none';
      duplicateProgressContainer.style.display = 'block';
      duplicateResults.innerHTML = '';
      duplicateProgressBar.style.width = '0%';
      duplicateProgressText.style.color = '';
      duplicateProgressText.textContent = 'Gathering bookmarks...';
    }

    function showLoadError() {
      duplicateProgressText.textContent = 'Unable to load bookmarks for duplicate check.';
      duplicateProgressText.style.color = '#ef4444';
      startDuplicateCheckBtn.style.display = 'inline-flex';
      reportChromeError('Error loading bookmarks for duplicate check');
    }

    function startDuplicateCheck() {
      resetProgress();

      chromeApi.bookmarks.getTree((bookmarkTreeNodes) => {
        if (chromeApi.runtime.lastError) {
          showLoadError();
          return;
        }

        const allBookmarks = gatherAllBookmarks(bookmarkTreeNodes);
        const totalCount = allBookmarks.length;

        if (totalCount === 0) {
          duplicateProgressText.textContent = 'No bookmarks to check.';
          startDuplicateCheckBtn.style.display = 'inline-flex';
          return;
        }

        duplicateProgressText.textContent = `Checking duplicate URLs (${totalCount} bookmarks)...`;
        const duplicates = findDuplicateBookmarks(allBookmarks);

        renderDuplicates(duplicates);
        duplicateProgressBar.style.width = '100%';
        duplicateProgressText.textContent = `Duplicate check complete. Checked ${totalCount} bookmark(s).`;
        if (duplicates.length === 0) {
          renderNoDuplicates(duplicateResults);
        }
        startDuplicateCheckBtn.style.display = 'inline-flex';
      });
    }

    startDuplicateCheckBtn.addEventListener('click', startDuplicateCheck);

    return {
      startDuplicateCheck
    };
  }

  return {
    gatherAllBookmarks,
    createDuplicateFinderController
  };
});
