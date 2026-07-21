import { create } from 'zustand';
import { normalizeFolderStyleRecords } from '../lib/bookmark-utils.ts';
import type { FolderStyleRecord } from '../types.ts';

// Folder color/icon records, cached from chrome.storage.sync. Writes are made
// by the folder-style editing action; edits from other synced devices arrive
// via applyStorageChange.
interface FolderStylesStore {
  styles: FolderStyleRecord[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setStyles: (next: FolderStyleRecord[]) => void;
  /** Apply an external chrome.storage.sync change, ignoring no-op updates. */
  applyStorageChange: (newValue: unknown) => void;
}

export const useFolderStylesStore = create<FolderStylesStore>((set, get) => ({
  styles: [],
  hydrated: false,

  hydrate: () =>
    new Promise((resolve) => {
      chrome.storage.sync.get(['folderStyles'], (result) => {
        if (chrome.runtime.lastError) {
          set({ styles: [], hydrated: true });
          resolve();
          return;
        }
        set({ styles: normalizeFolderStyleRecords(result.folderStyles), hydrated: true });
        resolve();
      });
    }),

  setStyles: (next) => set({ styles: next }),

  applyStorageChange: (newValue) => {
    const next = normalizeFolderStyleRecords(newValue);
    // Writes made by this panel are already in the cache; skip identical values
    // so a device's own write doesn't trigger a redundant re-render.
    if (JSON.stringify(next) === JSON.stringify(get().styles)) return;
    set({ styles: next });
  },
}));
