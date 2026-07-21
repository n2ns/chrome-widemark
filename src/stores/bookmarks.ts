import { create } from 'zustand';
import type { BookmarkNode } from '../types.ts';

// The bookmark tree plus expansion state. Chrome bookmark events reload the
// tree, but per-event reloads are suppressed during a bulk import or an
// explicit batch (sort/cleanup) — the batch/import boundary reloads once.
interface BookmarksStore {
  tree: BookmarkNode[];
  expandedFolderIds: Set<string>;
  loaded: boolean;
  batchDepth: number;
  isImporting: boolean;

  reload: () => Promise<void>;
  onBookmarkEvent: () => void;
  beginBatch: () => void;
  endBatch: () => void;
  onImportBegan: () => void;
  onImportEnded: () => void;

  setExpanded: (id: string, expanded: boolean) => void;
  setExpandedIds: (ids: Iterable<string>) => void;
}

export const useBookmarksStore = create<BookmarksStore>((set, get) => ({
  tree: [],
  expandedFolderIds: new Set<string>(),
  loaded: false,
  batchDepth: 0,
  isImporting: false,

  reload: () =>
    new Promise((resolve) => {
      chrome.bookmarks.getTree((nodes) => {
        set({ tree: nodes, loaded: true });
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

  setExpanded: (id, expanded) =>
    set((s) => {
      const nextIds = new Set(s.expandedFolderIds);
      if (expanded) nextIds.add(id);
      else nextIds.delete(id);
      return { expandedFolderIds: nextIds };
    }),

  setExpandedIds: (ids) => set({ expandedFolderIds: new Set(ids) }),
}));
