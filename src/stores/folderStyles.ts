import { create } from 'zustand';
import { loadFolderStyleRecords } from '../lib/folder-style-storage.ts';
import type { FolderStyleRecord } from '../types.ts';

// Folder color/icon records, cached from chrome.storage.sync. Writes are made
// by the folder-style editing action; Chrome storage changes trigger a reload
// through the central event subscription.
interface FolderStylesStore {
  styles: FolderStyleRecord[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  reload: () => Promise<void>;
  setStyles: (next: FolderStyleRecord[]) => void;
}

let loadGeneration = 0;

export const useFolderStylesStore = create<FolderStylesStore>((set, get) => ({
  styles: [],
  hydrated: false,

  hydrate: async () => {
    const generation = ++loadGeneration;
    try {
      const styles = await loadFolderStyleRecords();
      if (generation === loadGeneration) set({ styles, hydrated: true });
    } catch {
      if (generation === loadGeneration) set({ styles: [], hydrated: true });
    }
  },

  reload: async () => {
    const generation = ++loadGeneration;
    try {
      const next = await loadFolderStyleRecords();
      if (generation === loadGeneration && JSON.stringify(next) !== JSON.stringify(get().styles)) {
        set({ styles: next, hydrated: true });
      }
    } catch {
      // Keep the last successfully loaded styles on transient sync failures.
    }
  },

  setStyles: (next) => set({ styles: next }),
}));
