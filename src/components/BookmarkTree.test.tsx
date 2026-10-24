import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BookmarkTree } from './BookmarkTree.tsx';
import { useBookmarksStore } from '../stores/bookmarks.ts';
import { useSettingsStore, SETTINGS_DEFAULTS } from '../stores/settings.ts';
import { useFolderStylesStore } from '../stores/folderStyles.ts';
import { useUiStore } from '../stores/ui.ts';
import { assignStylesToTree } from '../lib/folder-style-assignment.ts';
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
          { id: 'b1', title: 'GitHub', url: 'https://github.com/' },
          {
            id: 'f1',
            title: 'Work',
            dateAdded: 100,
            children: [{ id: 'b2', title: 'Docs', url: 'https://docs.example/' }],
          },
        ],
      },
      { id: '2', title: 'Other Bookmarks', children: [] },
    ],
  },
] as unknown as BookmarkNode[]);

beforeEach(() => {
  useSettingsStore.setState({ ...SETTINGS_DEFAULTS, hydrated: true });
  useFolderStylesStore.setState({ styles: [], hydrated: true });
  useBookmarksStore.setState({ tree, recent: [], expandedFolderIds: new Set(), loaded: true });
  useUiStore.setState({ view: 'main', searchQuery: '', focusedNodeId: null, revealedRootId: null, revealTargetId: null });

  vi.stubGlobal('chrome', {
    runtime: { getURL: (p: string) => `chrome-extension://id${p}`, lastError: undefined },
    tabs: { update: vi.fn(), create: vi.fn() },
    storage: { local: { set: vi.fn() } },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('BookmarkTree', () => {
  it('renders bookmarks and folders from the store', () => {
    render(<BookmarkTree />);
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('toggles a folder open on click', () => {
    render(<BookmarkTree />);
    const folder = screen.getByText('Work').closest('.tree-node');
    expect(folder).not.toHaveClass('expanded');

    fireEvent.click(folder!);
    expect(screen.getByText('Work').closest('.tree-node')).toHaveClass('expanded');
    expect(useBookmarksStore.getState().expandedFolderIds.has('f1')).toBe(true);
  });

  it('opens a bookmark in the current tab by default', () => {
    render(<BookmarkTree />);
    fireEvent.click(screen.getByText('GitHub'));
    expect(chrome.tabs.update).toHaveBeenCalledWith({ url: 'https://github.com/' });
  });

  it('shows flat ranked results in search mode', () => {
    useSettingsStore.setState({ isSearchOpen: true });
    useUiStore.setState({ searchQuery: 'doc' });
    render(<BookmarkTree />);
    expect(screen.getByText('Docs')).toBeInTheDocument();
    expect(screen.queryByText('Work')).not.toBeInTheDocument(); // unrelated folders are not results
    expect(screen.getByText('Bookmarks Bar / Work')).toBeInTheDocument();
  });

  it('reveals a bookmark, expands its ancestry and moves DOM focus without opening it', () => {
    useSettingsStore.setState({ isSearchOpen: true });
    useUiStore.setState({ searchQuery: 'doc' });
    render(<BookmarkTree />);

    fireEvent.click(screen.getByRole('button', { name: 'Show in folder: Docs' }));

    expect(useUiStore.getState().searchQuery).toBe('');
    expect(useBookmarksStore.getState().expandedFolderIds.has('f1')).toBe(true);
    expect(document.activeElement).toHaveAttribute('data-focus-key', 'b2');
    expect(chrome.tabs.update).not.toHaveBeenCalled();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it('finds a folder and reveals its children on Enter', () => {
    useSettingsStore.setState({ isSearchOpen: true });
    useUiStore.setState({ searchQuery: 'work' });
    render(<BookmarkTree />);
    const folder = screen.getByText('Work').closest('[role="treeitem"]')!;
    expect(screen.queryByText('Docs')).not.toBeInTheDocument();
    expect(screen.getByText('Folder ·')).toBeInTheDocument();
    fireEvent.keyDown(folder, { key: 'Enter' });
    expect(screen.getByText('Docs')).toBeInTheDocument();
    expect(document.activeElement).toHaveAttribute('data-focus-key', 'f1');
  });

  it('reveals a hidden root without persisting a change to its visibility preference', () => {
    useSettingsStore.setState({ isSearchOpen: true, showOtherBookmarks: false });
    useUiStore.setState({ searchQuery: 'other' });
    render(<BookmarkTree />);
    fireEvent.click(screen.getByText('Other Bookmarks'));
    expect(document.activeElement).toHaveAttribute('data-focus-key', '2');
    expect(useSettingsStore.getState().showOtherBookmarks).toBe(false);
    expect(chrome.storage.local.set).not.toHaveBeenCalledWith(expect.objectContaining({ showOtherBookmarks: true }));
  });

  it('can reveal the normally implicit bookmarks bar itself', () => {
    useSettingsStore.setState({ isSearchOpen: true });
    useUiStore.setState({ searchQuery: 'bookmarks bar' });
    render(<BookmarkTree />);
    fireEvent.click(screen.getByText('Bookmarks Bar'));
    expect(document.activeElement).toHaveAttribute('data-focus-key', '1');
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });

  it('still renders recent bookmarks when the visible tree is empty', () => {
    useSettingsStore.setState({ showOtherBookmarks: false, showRecent: true });
    useBookmarksStore.setState({
      tree: [{ id: '0', title: '', syncing: false, children: [{ id: '1', title: 'Bookmarks Bar', syncing: false, children: [] }] }],
      recent: [{ id: 'recent', title: 'Recent Link', url: 'https://recent.example/', syncing: false }],
    });

    render(<BookmarkTree />);
    expect(screen.getByText('Recent Link')).toBeInTheDocument();
    expect(screen.queryByText('No bookmarks in the Bookmarks Bar.')).not.toBeInTheDocument();
  });
});

describe('assignStylesToTree', () => {
  it('maps a folder id to its style record by dateAdded', () => {
    const styles = [{ dateAdded: 100, title: 'Work', path: ['Work'], color: '#f00', icon: 'star' }];
    const map = assignStylesToTree(tree[0]!.children![0]!.children!, styles);
    expect(map.get('f1')).toMatchObject({ color: '#f00', icon: 'star' });
  });
});
