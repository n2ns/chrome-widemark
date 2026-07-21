import { create } from 'zustand';
import type { BookmarkNode } from '../types.ts';

// The currently open right-click menu: its target node and screen position.
interface ContextMenuStore {
  target: BookmarkNode | null;
  x: number;
  y: number;
  open: (target: BookmarkNode, x: number, y: number) => void;
  close: () => void;
}

export const useContextMenuStore = create<ContextMenuStore>((set) => ({
  target: null,
  x: 0,
  y: 0,
  open: (target, x, y) => set({ target, x, y }),
  close: () => set({ target: null }),
}));
