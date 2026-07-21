import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, renderHook } from '@testing-library/react';
import { BookmarkTree } from '../components/BookmarkTree.tsx';
import { useKeyboardNav } from './useKeyboardNav.ts';
import { flattenVisibleNodes } from '../lib/visible-nodes.ts';
import { useBookmarksStore } from '../stores/bookmarks.ts';
import { useSettingsStore, SETTINGS_DEFAULTS } from '../stores/settings.ts';
import { useUiStore } from '../stores/ui.ts';
import { useFolderStylesStore } from '../stores/folderStyles.ts';
import type { BookmarkNode } from '../types.ts';

const tree = ([
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: 'Bookmarks Bar',
        children: [
          { id: 'b1', title: 'GitHub', url: 'https://github.com/', index: 0 },
          { id: 'f1', title: 'Work', index: 1, children: [{ id: 'b2', title: 'Docs', url: 'https://docs.example/', index: 0 }] },
        ],
      },
    ],
  },
] as unknown as BookmarkNode[]);

function makeDataTransfer() {
  const data: Record<string, string> = {};
  return {
    setData: (k: string, v: string) => {
      data[k] = v;
    },
    getData: (k: string) => data[k] ?? '',
    get types() {
      return Object.keys(data);
    },
  };
}

beforeEach(() => {
  useSettingsStore.setState({ ...SETTINGS_DEFAULTS, hydrated: true });
  useFolderStylesStore.setState({ styles: [] });
  useBookmarksStore.setState({ tree, recent: [], expandedFolderIds: new Set(['f1']), loaded: true });
  useUiStore.setState({ view: 'main', searchQuery: '', recentExpanded: true, focusedNodeId: null });
  vi.stubGlobal('chrome', {
    runtime: { getURL: (p: string) => p, lastError: undefined },
    tabs: { update: vi.fn(), create: vi.fn() },
    bookmarks: { move: vi.fn(), create: vi.fn() },
    storage: { local: { set: vi.fn() } },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('flattenVisibleNodes', () => {
  it('lists rows in on-screen order, descending into expanded folders', () => {
    const ids = flattenVisibleNodes(tree, true, new Set(['f1'])).map((n) => n.id);
    expect(ids).toEqual(['b1', 'f1', 'b2']);
  });

  it('skips collapsed folder children', () => {
    const ids = flattenVisibleNodes(tree, true, new Set()).map((n) => n.id);
    expect(ids).toEqual(['b1', 'f1']);
  });
});

describe('keyboard navigation', () => {
  it('ArrowDown moves focus and Enter toggles a focused folder', () => {
    renderHook(() => useKeyboardNav());

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    expect(useUiStore.getState().focusedNodeId).toBe('b1');

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    expect(useUiStore.getState().focusedNodeId).toBe('f1');

    // f1 starts expanded; Enter on it collapses.
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(useBookmarksStore.getState().expandedFolderIds.has('f1')).toBe(false);
  });

  it('"/" opens the search box', () => {
    renderHook(() => useKeyboardNav());
    expect(useSettingsStore.getState().isSearchOpen).toBe(false);
    fireEvent.keyDown(document.body, { key: '/' });
    expect(useSettingsStore.getState().isSearchOpen).toBe(true);
  });

  it('navigates only the rows rendered by an active search', () => {
    useSettingsStore.setState({ isSearchOpen: true });
    useUiStore.setState({ searchQuery: 'docs', focusedNodeId: null });
    render(<BookmarkTree />);
    renderHook(() => useKeyboardNav());

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    expect(useUiStore.getState().focusedNodeId).toBe('search:b2');
    expect(screen.getByText('Docs').closest('.bookmark-item')).toHaveClass('kb-focus');

    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(chrome.tabs.update).toHaveBeenCalledWith({ url: 'https://docs.example/' });
  });

  it('navigates a recent bookmark independently from its tree copy', () => {
    useBookmarksStore.setState({ recent: [tree[0]!.children![0]!.children![0]!] });
    render(<BookmarkTree />);
    renderHook(() => useKeyboardNav());

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    expect(useUiStore.getState().focusedNodeId).toBe('recent:b1');

    const githubRows = screen.getAllByText('GitHub').map((el) => el.closest('.bookmark-item'));
    expect(githubRows[0]).toHaveClass('kb-focus');
    expect(githubRows[1]).not.toHaveClass('kb-focus');
  });
});

describe('drag and drop', () => {
  it('dropping a bookmark onto a folder moves it via chrome.bookmarks.move', () => {
    render(<BookmarkTree />);
    const source = screen.getByText('GitHub').closest('.bookmark-item')!;
    const targetFolder = screen.getByText('Work').closest('.tree-node')!;

    const dt = makeDataTransfer();
    fireEvent.dragStart(source, { dataTransfer: dt });
    fireEvent.drop(targetFolder, { dataTransfer: dt, clientY: 5 });

    expect(chrome.bookmarks.move).toHaveBeenCalledWith('b1', expect.anything());
  });
});
