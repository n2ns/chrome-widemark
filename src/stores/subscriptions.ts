import { useBookmarksStore } from './bookmarks.ts';
import { useFolderStylesStore } from './folderStyles.ts';

// Wire Chrome events into the stores. Called once at app startup. Zustand
// actions have stable identity, so the bound references are valid listeners.
export function initChromeSubscriptions() {
  const bookmarks = useBookmarksStore.getState();

  chrome.bookmarks.onImportBegan.addListener(bookmarks.onImportBegan);
  chrome.bookmarks.onImportEnded.addListener(bookmarks.onImportEnded);
  chrome.bookmarks.onCreated.addListener(bookmarks.onBookmarkEvent);
  chrome.bookmarks.onRemoved.addListener(bookmarks.onBookmarkEvent);
  chrome.bookmarks.onChanged.addListener(bookmarks.onBookmarkEvent);
  chrome.bookmarks.onMoved.addListener(bookmarks.onBookmarkEvent);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.folderStyles) {
      useFolderStylesStore.getState().applyStorageChange(changes.folderStyles.newValue);
    }
  });
}
