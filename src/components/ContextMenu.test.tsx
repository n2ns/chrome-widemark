import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ContextMenu } from './ContextMenu.tsx';
import { ModalHost } from './ModalHost.tsx';
import { useContextMenuStore } from '../stores/contextMenu.ts';
import { useModalStore } from '../stores/modal.ts';
import { useOperationsStore } from '../stores/operations.ts';
import { useBookmarksStore } from '../stores/bookmarks.ts';
import { useFolderStylesStore } from '../stores/folderStyles.ts';
import { useSettingsStore, SETTINGS_DEFAULTS } from '../stores/settings.ts';
import { loadFolderStyleRecords } from '../lib/folder-style-storage.ts';
import type { BookmarkNode } from '../types.ts';

const bookmark = { id: 'b1', title: 'GitHub', url: 'https://github.com/' } as unknown as BookmarkNode;
const folder = { id: 'f1', title: 'Work', children: [] } as unknown as BookmarkNode;
const permanentFolder = { id: '2', title: 'Other Bookmarks', children: [] } as unknown as BookmarkNode;

function renderMenu() {
  return render(
    <>
      <ContextMenu />
      <ModalHost />
    </>
  );
}

beforeEach(() => {
  useContextMenuStore.setState({ target: null, x: 0, y: 0 });
  useModalStore.setState({ active: null });
  useOperationsStore.setState({ bookmarkMutationBusy: false, cleanupBusy: false, cleanupStatus: '' });
  useSettingsStore.setState({ ...SETTINGS_DEFAULTS });
  useBookmarksStore.setState({ tree: [] });
  useFolderStylesStore.setState({ styles: [] });
  vi.stubGlobal('chrome', {
    bookmarks: {
      remove: vi.fn((_id: string, cb?: () => void) => cb?.()),
      removeTree: vi.fn((_id: string, cb?: () => void) => cb?.()),
      update: vi.fn((_id: string, _changes: object, cb?: () => void) => cb?.()),
      create: vi.fn((_details: object, cb?: () => void) => cb?.()),
    },
    runtime: { lastError: undefined },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ContextMenu', () => {
  it('renames an existing non-web bookmark without writing its URL', async () => {
    useContextMenuStore.getState().open({ ...bookmark, url: 'mailto:person@example.com' }, 10, 10);
    renderMenu();
    fireEvent.click(screen.getByText('Rename / Edit'));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(chrome.bookmarks.update).toHaveBeenCalledWith(
      'b1', { title: 'Renamed' }, expect.any(Function)
    ));
  });

  it.each(['hidden folder', 'bookmarks bar'])('preserves color when editing the icon of a %s', async (kind) => {
    const target = { id: kind === 'hidden folder' ? 'f2' : '1', title: kind, dateAdded: 100, children: [] } as unknown as BookmarkNode;
    const roots = kind === 'hidden folder'
      ? [{ id: '1', title: 'Bookmarks Bar', children: [] }, { id: '2', title: 'Other Bookmarks', children: [target] }]
      : [target];
    const tree = [{ id: '0', title: '', children: roots }] as unknown as BookmarkNode[];
    const path = kind === 'hidden folder' ? ['Other Bookmarks', target.title] : [target.title];
    const styles = [{ dateAdded: 100, title: target.title, path, color: '#ef4444', icon: 'star' }];
    const values: Record<string, unknown> = { folderStyles: styles };
    vi.stubGlobal('chrome', {
      ...chrome,
      bookmarks: { ...chrome.bookmarks, getTree: (cb: (nodes: BookmarkNode[]) => void) => cb(tree) },
      storage: { sync: {
        get: (_keys: unknown, cb: (data: object) => void) => cb(structuredClone(values)),
        set: (updates: object, cb: () => void) => { Object.assign(values, structuredClone(updates)); cb(); },
        remove: (keys: string | string[], cb: () => void) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
          cb();
        },
      } },
    });
    useSettingsStore.setState({ showOtherBookmarks: false });
    useBookmarksStore.setState({ tree });
    useFolderStylesStore.setState({ styles });
    useContextMenuStore.getState().open(target, 10, 10);
    renderMenu();
    fireEvent.click(screen.getByText('Folder Style'));
    expect(await screen.findByRole('button', { name: 'Red' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Fav' }));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(useOperationsStore.getState().bookmarkMutationBusy).toBe(false));
    expect(await loadFolderStyleRecords()).toEqual([
      { dateAdded: 100, title: target.title, path, color: '#ef4444', icon: 'heart' },
    ]);
  });

  it('shows bookmark actions but hides folder-only Sort', () => {
    useContextMenuStore.getState().open(bookmark, 10, 10);
    renderMenu();
    expect(screen.getByText('Add Bookmark')).toBeInTheDocument();
    expect(screen.getByText('Rename / Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.queryByText('Sort by Name')).not.toBeInTheDocument();
    expect(screen.queryByText('Folder Style')).not.toBeInTheDocument();
  });

  it('shows Sort and Folder Style for a folder', () => {
    useContextMenuStore.getState().open(folder, 10, 10);
    renderMenu();
    expect(screen.getByText('Sort by Name')).toBeInTheDocument();
    expect(screen.getByText('Folder Style')).toBeInTheDocument();
  });

  it('hides Edit/Delete for a permanent folder but keeps Folder Style', () => {
    useContextMenuStore.getState().open(permanentFolder, 10, 10);
    renderMenu();
    expect(screen.queryByText('Rename / Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    expect(screen.getByText('Folder Style')).toBeInTheDocument();
  });

  it('Delete confirms then removes the bookmark', async () => {
    useContextMenuStore.getState().open(bookmark, 10, 10);
    renderMenu();
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(await screen.findByText('Delete')); // confirm button
    await vi.waitFor(() => expect(chrome.bookmarks.remove).toHaveBeenCalledWith('b1', expect.any(Function)));
  });

  it('keeps the menu inside the viewport', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 160,
      height: 240,
      top: 0,
      right: 160,
      bottom: 240,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.stubGlobal('innerWidth', 300);
    vi.stubGlobal('innerHeight', 400);
    useContextMenuStore.getState().open(folder, 290, 390);
    renderMenu();

    const menu = screen.getByRole('menu');
    await waitFor(() => {
      expect(menu).toHaveStyle({ left: '132px', top: '152px' });
    });
  });
});
