import type { FolderStyleRecord } from './types.ts';
import * as bookmarkUtils from './bookmark-utils.ts';
import * as WideMarkIcons from './ui-icons.ts';
import { createBookmarkTreeController } from './bookmark-tree-controller.ts';
import { createDuplicateFinderController } from './duplicate-finder-controller.ts';
import { createCleanupController } from './cleanup-controller.ts';
import { createModalDialog } from './modal-dialog.ts';
import { createContextMenuController } from './context-menu-controller.ts';
import { createSettingsController } from './settings-controller.ts';

document.addEventListener('DOMContentLoaded', () => {
  const {
    bookmarkDomain,
    sortNodes,
    computeMoveDestination,
    normalizeFolderStyleRecords,
    assignFolderStyles,
    replaceFolderStyle
  } = bookmarkUtils;
  const treeContainer = document.getElementById('bookmark-tree-root') as HTMLElement;
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const clearSearchBtn = document.getElementById('clear-search') as HTMLElement;
  const toggleAllBtn = document.getElementById('toggle-all-btn') as HTMLElement;
  const searchToggleBtn = document.getElementById('search-toggle-btn') as HTMLElement;
  const searchBarContainer = document.querySelector('.search-bar-container') as HTMLElement;
  const appState = {
    isSearchOpen: false,
    isFoldersExpanded: false,
    leftClickAction: 'current',
    dragProtectionEnabled: false,
    tooltipEnabled: true,
    showOtherBookmarks: true,
    showRecent: true
  };
  let folderStylesCache: FolderStyleRecord[] = [];
  let bookmarkTree: ReturnType<typeof createBookmarkTreeController>;

  // Batch operations (sort, cleanup) fire one bookmark event per move;
  // suppress per-event re-renders and refresh once at the end.
  let batchDepth = 0;
  function beginBatchUpdates() {
    batchDepth += 1;
  }
  function endBatchUpdates() {
    batchDepth = Math.max(0, batchDepth - 1);
    if (batchDepth === 0) bookmarkTree.refreshView();
  }

  function reportChromeError(action: string) {
    if (chrome.runtime.lastError) {
      console.error(`${action}:`, chrome.runtime.lastError.message);
    }
  }

  function initFolderStyles(callback?: () => void) {
    chrome.storage.sync.get(['folderStyles'], (result) => {
      folderStylesCache = normalizeFolderStyleRecords(result.folderStyles);
      if (callback) callback();
    });
  }

  const modalDialog = createModalDialog(document);
  const { bindContextMenu, hideContextMenu } = createContextMenuController({
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
    replaceFolderStyle,
    computeSortedChildren: bookmarkUtils.computeSortedChildren,
    beginBatchUpdates,
    endBatchUpdates
  });

  bookmarkTree = createBookmarkTreeController({
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
    icons: WideMarkIcons
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const modal = document.getElementById('custom-modal');
      if (modal && modal.style.display === 'flex') {
        modalDialog.cancelActiveModal();
      }
      hideContextMenu();
      return;
    }

    // "/" focuses (and if needed opens) the search box from anywhere in the
    // main view.
    if (event.key === '/') {
      const target = event.target as HTMLElement | null;
      const isTyping = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      const modal = document.getElementById('custom-modal');
      const mainView = document.getElementById('main-view');
      if (isTyping || (modal && modal.style.display === 'flex') ||
        (mainView && mainView.style.display === 'none')) {
        return;
      }
      event.preventDefault();
      if (!appState.isSearchOpen) {
        searchToggleBtn.click();
      } else {
        searchInput.focus();
      }
    }
  });

  const settingsController = createSettingsController({
    document,
    chromeApi: chrome,
    state: appState,
    toolbarIcons: WideMarkIcons.toolbarIcons,
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

  createDuplicateFinderController({
    document,
    chromeApi: chrome,
    bookmarkUtils,
    handleBookmarkClick: (url, event) => bookmarkTree.handleBookmarkClick(url, event as MouseEvent),
    modalDialog,
    reportChromeError
  });

  createCleanupController({
    document,
    chromeApi: chrome,
    bookmarkUtils,
    modalDialog,
    reportChromeError,
    beginBatchUpdates,
    endBatchUpdates
  });

  // During a bookmark import Chrome fires onCreated per node; ignore those
  // and re-render once at the end (per the chrome.bookmarks API guidance).
  let isImportingBookmarks = false;
  chrome.bookmarks.onImportBegan.addListener(() => {
    isImportingBookmarks = true;
  });
  chrome.bookmarks.onImportEnded.addListener(() => {
    isImportingBookmarks = false;
    if (batchDepth === 0) bookmarkTree.refreshView();
  });

  chrome.bookmarks.onCreated.addListener(() => {
    if (!isImportingBookmarks && batchDepth === 0) bookmarkTree.refreshView();
  });
  chrome.bookmarks.onRemoved.addListener(() => {
    if (batchDepth === 0) bookmarkTree.refreshView();
  });
  chrome.bookmarks.onChanged.addListener(() => {
    if (batchDepth === 0) bookmarkTree.refreshView();
  });
  chrome.bookmarks.onMoved.addListener(() => {
    if (batchDepth === 0) bookmarkTree.refreshView();
  });

  // Folder styles edited on another synced device arrive through storage
  // sync; refresh the cache and re-render. Writes made by this panel are
  // already in the cache and are skipped.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes.folderStyles) return;
    const nextStyles = normalizeFolderStyleRecords(changes.folderStyles.newValue);
    if (JSON.stringify(nextStyles) === JSON.stringify(folderStylesCache)) return;
    folderStylesCache = nextStyles;
    // During a batch the cache update is enough; endBatchUpdates re-renders.
    if (batchDepth === 0) bookmarkTree.refreshView();
  });

  settingsController.initSettings();
});
