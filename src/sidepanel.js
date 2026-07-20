document.addEventListener('DOMContentLoaded', () => {
  const bookmarkUtils = window.BookmarkSidebarUtils;
  const {
    bookmarkDomain,
    sortNodes,
    computeMoveDestination,
    normalizeFolderStyleRecords,
    assignFolderStyles,
    replaceFolderStyle
  } = bookmarkUtils;
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
  let folderStylesCache = [];
  let bookmarkTree;

  function reportChromeError(action) {
    if (chrome.runtime.lastError) {
      console.error(`${action}:`, chrome.runtime.lastError.message);
    }
  }

  function initFolderStyles(callback) {
    chrome.storage.sync.get(['folderStyles'], (result) => {
      folderStylesCache = normalizeFolderStyleRecords(result.folderStyles);
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
    reportChromeError,
    getAssignedStyle: (nodeId) => bookmarkTree.getAssignedStyle(nodeId),
    getFolderIdentity: (nodeId) => bookmarkTree.getFolderIdentity(nodeId),
    refreshRecordMetadata: (records) => bookmarkTree.refreshRecordMetadata(records),
    replaceFolderStyle
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
    assignFolderStyles,
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
    initBookmarkTree: () => bookmarkTree.initTree(),
    loadBookmarks: (silent) => bookmarkTree.loadBookmarks(silent),
    refreshView: () => bookmarkTree.refreshView(),
    initFolderStyles,
    modalDialog,
    reportChromeError
  });

  window.WideMarkDuplicateFinder.createDuplicateFinderController({
    document,
    chromeApi: chrome,
    bookmarkUtils,
    handleBookmarkClick: (url, event) => bookmarkTree.handleBookmarkClick(url, event),
    modalDialog,
    reportChromeError
  });

  // During a bookmark import Chrome fires onCreated per node; ignore those
  // and re-render once at the end (per the chrome.bookmarks API guidance).
  let isImportingBookmarks = false;
  chrome.bookmarks.onImportBegan.addListener(() => {
    isImportingBookmarks = true;
  });
  chrome.bookmarks.onImportEnded.addListener(() => {
    isImportingBookmarks = false;
    bookmarkTree.refreshView();
  });

  chrome.bookmarks.onCreated.addListener(() => {
    if (!isImportingBookmarks) bookmarkTree.refreshView();
  });
  chrome.bookmarks.onRemoved.addListener(() => bookmarkTree.refreshView());
  chrome.bookmarks.onChanged.addListener(() => bookmarkTree.refreshView());
  chrome.bookmarks.onMoved.addListener(() => bookmarkTree.refreshView());

  // Folder styles edited on another synced device arrive through storage
  // sync; refresh the cache and re-render. Writes made by this panel are
  // already in the cache and are skipped.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes.folderStyles) return;
    const nextStyles = normalizeFolderStyleRecords(changes.folderStyles.newValue);
    if (JSON.stringify(nextStyles) === JSON.stringify(folderStylesCache)) return;
    folderStylesCache = nextStyles;
    bookmarkTree.refreshView();
  });

  settingsController.initSettings();
});
