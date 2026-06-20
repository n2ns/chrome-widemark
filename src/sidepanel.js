document.addEventListener('DOMContentLoaded', () => {
  const { bookmarkDomain, sortNodes, computeMoveDestination, findDuplicateBookmarks } = window.BookmarkSidebarUtils;
  const treeContainer = document.getElementById('bookmark-tree-root');
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search');
  const toggleAllBtn = document.getElementById('toggle-all-btn');
  const searchToggleBtn = document.getElementById('search-toggle-btn');
  const searchBarContainer = document.querySelector('.search-bar-container');
  const appState = {
    isSearchOpen: false,
    isFoldersExpanded: false,
    leftClickAction: 'current',
    dragProtectionEnabled: false,
    tooltipEnabled: true
  };
  let folderStylesCache = {};
  let bookmarkTree;

  function reportChromeError(action) {
    if (chrome.runtime.lastError) {
      console.error(`${action}:`, chrome.runtime.lastError.message);
    }
  }

  function initFolderStyles(callback) {
    chrome.storage.sync.get(['folderStyles'], (result) => {
      folderStylesCache = result.folderStyles || {};
      if (callback) callback();
    });
  }

  const modalDialog = window.WideMarkModalDialog.createModalDialog(document);
  const { bindContextMenu, hideContextMenu } = window.WideMarkContextMenu.createContextMenuController({
    document,
    windowObj: window,
    chromeApi: chrome,
    treeContainer,
    modalDialog,
    getFolderStyles: () => folderStylesCache,
    setFolderStyles: (nextStyles) => {
      folderStylesCache = nextStyles;
    },
    loadBookmarks: (silent) => bookmarkTree.loadBookmarks(silent),
    reportChromeError
  });

  bookmarkTree = window.WideMarkBookmarkTree.createBookmarkTreeController({
    document,
    chromeApi: chrome,
    state: appState,
    treeContainer,
    searchInput,
    clearSearchBtn,
    toggleAllBtn,
    bindContextMenu,
    getFolderStyles: () => folderStylesCache,
    reportChromeError,
    bookmarkDomain,
    sortNodes,
    computeMoveDestination,
    icons: window.WideMarkIcons
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const modal = document.getElementById('custom-modal');
      if (modal && modal.style.display === 'flex') {
        modalDialog.cancelActiveModal();
      }
      hideContextMenu();
    }
  });

  const settingsController = window.WideMarkSettings.createSettingsController({
    document,
    chromeApi: chrome,
    state: appState,
    toolbarIcons: window.WideMarkIcons.toolbarIcons,
    searchInput,
    clearSearchBtn,
    searchToggleBtn,
    searchBarContainer,
    toggleAllBtn,
    updateToggleAllButton: () => bookmarkTree.updateToggleAllButton(),
    applyFoldersExpandedState: () => bookmarkTree.applyFoldersExpandedState(),
    loadBookmarks: (silent) => bookmarkTree.loadBookmarks(silent),
    initFolderStyles,
    modalDialog,
    reportChromeError
  });

  window.WideMarkDuplicateFinder.createDuplicateFinderController({
    document,
    chromeApi: chrome,
    findDuplicateBookmarks,
    handleBookmarkClick: (url, event) => bookmarkTree.handleBookmarkClick(url, event),
    modalDialog,
    reportChromeError
  });

  chrome.bookmarks.onCreated.addListener(() => bookmarkTree.loadBookmarks(true));
  chrome.bookmarks.onRemoved.addListener(() => bookmarkTree.loadBookmarks(true));
  chrome.bookmarks.onChanged.addListener(() => bookmarkTree.loadBookmarks(true));
  chrome.bookmarks.onMoved.addListener(() => bookmarkTree.loadBookmarks(true));

  settingsController.initSettings();
});
