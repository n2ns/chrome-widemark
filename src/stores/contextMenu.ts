import { create } from 'zustand';
import type { BookmarkNode } from '../types.ts';

// The currently open right-click menu: its target node and screen position.
interface ContextMenuStore {
  target: BookmarkNode | null;
  x: number;
  y: number;
  trigger: HTMLElement | null;
  open: (target: BookmarkNode, x: number, y: number, trigger?: HTMLElement | null) => void;
  close: () => void;
}

export const useContextMenuStore = create<ContextMenuStore>((set) => ({
  target: null,
  x: 0,
  y: 0,
  trigger: null,
  open: (target, x, y, trigger = null) => set({ target, x, y, trigger }),
  close: () => set({ target: null }),
}));
