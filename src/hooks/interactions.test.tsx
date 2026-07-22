import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, renderHook } from '@testing-library/react';
import { BookmarkTree } from '../components/BookmarkTree.tsx';
import { useKeyboardNav } from './useKeyboardNav.ts';
import { flattenVisibleNodes } from '../lib/visible-nodes.ts';
import { useBookmarksStore } from '../stores/bookmarks.ts';
import { useSettingsStore, SETTINGS_DEFAULTS } from '../stores/settings.ts';
import { useUiStore } from '../stores/ui.ts';
import { useFolderStylesStore } from '../stores/folderStyles.ts';
import { useOperationsStore } from '../stores/operations.ts';
import { useContextMenuStore } from '../stores/contextMenu.ts';
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
  useOperationsStore.setState({ bookmarkMutationBusy: false, cleanupBusy: false, cleanupStatus: '' });
  useContextMenuStore.setState({ target: null, x: 0, y: 0, trigger: null });
  vi.stubGlobal('chrome', {
    runtime: { getURL: (p: string) => p, lastError: undefined },
    tabs: { update: vi.fn(), create: vi.fn() },
    bookmarks: {
      get: vi.fn((id: string, cb: (nodes: BookmarkNode[]) => void) => {
        const nodes = [tree[0]!, tree[0]!.children![0]!, ...tree[0]!.children![0]!.children!, ...tree[0]!.children![0]!.children![1]!.children!];
        cb(nodes.filter((node) => node.id === id));
      }),
      move: vi.fn((_id: string, _destination: object, cb?: () => void) => cb?.()),
      create: vi.fn((_details: object, cb?: () => void) => cb?.()),
    },
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

describe('tree rendering', () => {
  it('does not mount descendants of collapsed folders', () => {
    useBookmarksStore.setState({ expandedFolderIds: new Set() });
    render(<BookmarkTree />);

    expect(screen.getByText('Work').closest('[role="treeitem"]')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Docs')).not.toBeInTheDocument();
  });

  it('keeps the tree tabbable when the saved focus key is no longer visible', () => {
    useUiStore.setState({ focusedNodeId: 'missing-node' });
    render(<BookmarkTree />);

    expect(screen.getByRole('tree')).toHaveAttribute('tabindex', '0');
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

  it('moves real DOM focus with the visual tree focus', () => {
    render(<BookmarkTree />);
    renderHook(() => useKeyboardNav());
    const github = screen.getByText('GitHub').closest<HTMLElement>('[role="treeitem"]')!;
    github.focus();

    fireEvent.keyDown(github, { key: 'ArrowDown' });

    const work = screen.getByText('Work').closest<HTMLElement>('[role="treeitem"]')!;
    expect(document.activeElement).toBe(work);
    fireEvent.keyDown(work, { key: 'Enter' });
    expect(useBookmarksStore.getState().expandedFolderIds.has('f1')).toBe(false);
  });

  it('moves right into an expanded folder and left back to its parent', () => {
    render(<BookmarkTree />);
    renderHook(() => useKeyboardNav());
    const work = screen.getByText('Work').closest<HTMLElement>('[role="treeitem"]')!;
    work.focus();

    fireEvent.keyDown(work, { key: 'ArrowRight' });
    const docs = screen.getByText('Docs').closest<HTMLElement>('[role="treeitem"]')!;
    expect(document.activeElement).toBe(docs);

    fireEvent.keyDown(docs, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(work);
  });

  it('"/" opens the search box', () => {
    renderHook(() => useKeyboardNav());
    expect(useSettingsStore.getState().isSearchOpen).toBe(false);
    fireEvent.keyDown(document.body, { key: '/' });
    expect(useSettingsStore.getState().isSearchOpen).toBe(true);
  });

  it('does not send the search shortcut through an open context menu', () => {
    renderHook(() => useKeyboardNav());
    useContextMenuStore.setState({ target: tree[0]!.children![0]!.children![0]! });

    fireEvent.keyDown(document.body, { key: '/' });

    expect(useSettingsStore.getState().isSearchOpen).toBe(false);
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
    expect(useUiStore.getState().focusedNodeId).toBe('recent:header');
    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    expect(useUiStore.getState().focusedNodeId).toBe('recent:b1');

    const githubRows = screen.getAllByText('GitHub').map((el) => el.closest('.bookmark-item'));
    expect(githubRows[0]).toHaveClass('kb-focus');
    expect(githubRows[1]).not.toHaveClass('kb-focus');
  });

  it('toggles the recent treeitem once on Enter', () => {
    useBookmarksStore.setState({ recent: [tree[0]!.children![0]!.children![0]!] });
    render(<BookmarkTree />);
    renderHook(() => useKeyboardNav());
    const recent = screen.getByText('Recently Added').closest<HTMLElement>('[role="treeitem"]')!;
    recent.focus();

    fireEvent.keyDown(recent, { key: 'Enter' });

    expect(useUiStore.getState().recentExpanded).toBe(false);
  });
});

describe('drag and drop', () => {
  it('dropping a bookmark onto a folder moves it via chrome.bookmarks.move', async () => {
    render(<BookmarkTree />);
    const source = screen.getByText('GitHub').closest('.bookmark-item')!;
    const targetFolder = screen.getByText('Work').closest('.tree-node')!;

    const dt = makeDataTransfer();
    fireEvent.dragStart(source, { dataTransfer: dt });
    fireEvent.drop(targetFolder, { dataTransfer: dt, clientY: 5 });

    await vi.waitFor(() => {
      expect(chrome.bookmarks.move).toHaveBeenCalledWith('b1', expect.anything(), expect.any(Function));
    });
  });

  it('clears the source dragging state before a same-level drop starts a mutation', async () => {
    render(<BookmarkTree />);
    const source = screen.getByText('GitHub').closest('.bookmark-item')!;
    const target = screen.getByText('Work').closest('.tree-node')!;
    const dt = makeDataTransfer();

    fireEvent.dragStart(source, { dataTransfer: dt });
    expect(source).toHaveClass('dragging');
    fireEvent.drop(target, { dataTransfer: dt, clientY: 0 });

    await vi.waitFor(() => expect(source).not.toHaveClass('dragging'));
  });
});
