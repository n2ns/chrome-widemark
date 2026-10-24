import { create } from 'zustand';
import { gatherFolderIds } from '../lib/tree-logic.ts';
import type { BookmarkNode } from '../types.ts';

const RECENT_COUNT = 10;
let reloadGeneration = 0;

// The bookmark tree, recently-added list, and expansion state. Chrome bookmark
// events reload the tree, but per-event reloads are suppressed during a bulk
// import or an explicit batch (sort/cleanup) — the boundary reloads once.
interface BookmarksStore {
  tree: BookmarkNode[];
  recent: BookmarkNode[];
  expandedFolderIds: Set<string>;
  loaded: boolean;
  batchDepth: number;
  isImporting: boolean;

  reload: () => Promise<void>;
  hydrateExpanded: () => Promise<void>;
  onBookmarkEvent: () => void;
  beginBatch: () => void;
  endBatch: () => void;
  onImportBegan: () => void;
  onImportEnded: () => void;

  setExpanded: (id: string, expanded: boolean) => void;
  expandFolders: (ids: string[]) => void;
  expandAll: () => void;
  collapseAll: () => void;
}

function persistExpanded(ids: Set<string>) {
  chrome.storage.local.set({ expandedFolderIds: [...ids] });
}

export const useBookmarksStore = create<BookmarksStore>((set, get) => ({
  tree: [],
  recent: [],
  expandedFolderIds: new Set<string>(),
  loaded: false,
  batchDepth: 0,
  isImporting: false,

  reload: () => {
    const generation = ++reloadGeneration;
    return new Promise((resolve) => {
      chrome.bookmarks.getTree((nodes) => {
        if (chrome.runtime.lastError || !Array.isArray(nodes)) {
          if (generation === reloadGeneration) set({ loaded: true });
          resolve();
          return;
        }
        chrome.bookmarks.getRecent(RECENT_COUNT, (recent) => {
          const nextRecent = chrome.runtime.lastError || !Array.isArray(recent) ? [] : recent;
          if (generation === reloadGeneration) {
            set({ tree: nodes, recent: nextRecent, loaded: true });
          }
          resolve();
        });
      });
    });
  },

  hydrateExpanded: () =>
    new Promise((resolve) => {
      chrome.storage.local.get(['expandedFolderIds'], (result) => {
        if (chrome.runtime.lastError) {
          set({ expandedFolderIds: new Set() });
          resolve();
          return;
        }
        const ids: string[] = Array.isArray(result.expandedFolderIds) ? result.expandedFolderIds : [];
        set({ expandedFolderIds: new Set(ids) });
        resolve();
      });
    }),

  onBookmarkEvent: () => {
    const { batchDepth, isImporting, reload } = get();
    if (batchDepth === 0 && !isImporting) reload();
  },

  beginBatch: () => set((s) => ({ batchDepth: s.batchDepth + 1 })),

  endBatch: () => {
    const next = Math.max(0, get().batchDepth - 1);
    set({ batchDepth: next });
    if (next === 0) get().reload();
  },

  onImportBegan: () => set({ isImporting: true }),

  onImportEnded: () => {
    set({ isImporting: false });
    if (get().batchDepth === 0) get().reload();
  },

  setExpanded: (id, expanded) => {
    const nextIds = new Set(get().expandedFolderIds);
    if (expanded) nextIds.add(id);
    else nextIds.delete(id);
    set({ expandedFolderIds: nextIds });
    persistExpanded(nextIds);
  },

  expandAll: () => {
    const ids = new Set(gatherFolderIds(get().tree));
    set({ expandedFolderIds: ids });
    persistExpanded(ids);
  },

  expandFolders: (ids) => {
    const nextIds = new Set([...get().expandedFolderIds, ...ids]);
    set({ expandedFolderIds: nextIds });
    persistExpanded(nextIds);
  },

  collapseAll: () => {
    const ids = new Set<string>();
    set({ expandedFolderIds: ids });
    persistExpanded(ids);
  },
}));
