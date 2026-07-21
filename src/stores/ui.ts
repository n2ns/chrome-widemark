import { create } from 'zustand';

// Ephemeral panel UI state (not persisted): which top view is showing and the
// current search text. The search-open flag lives in the settings store since
// it is persisted.
export type PanelView = 'main' | 'settings' | 'actions' | 'help';

interface UiStore {
  view: PanelView;
  searchQuery: string;
  recentExpanded: boolean;
  /** Unique rendered-row key; prefixes distinguish recent/search duplicates. */
  focusedNodeId: string | null;
  setView: (view: PanelView) => void;
  toggleView: (view: PanelView) => void;
  setSearchQuery: (searchQuery: string) => void;
  setRecentExpanded: (expanded: boolean) => void;
  setFocusedNodeId: (id: string | null) => void;
}

export const useUiStore = create<UiStore>((set, get) => ({
  view: 'main',
  searchQuery: '',
  recentExpanded: true,
  focusedNodeId: null,
  setView: (view) => set({ view }),
  toggleView: (view) => set({ view: get().view === view ? 'main' : view }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setRecentExpanded: (recentExpanded) => set({ recentExpanded }),
  setFocusedNodeId: (focusedNodeId) => set({ focusedNodeId }),
}));
