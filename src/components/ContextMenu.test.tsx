import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ContextMenu } from './ContextMenu.tsx';
import { ModalHost } from './ModalHost.tsx';
import { useContextMenuStore } from '../stores/contextMenu.ts';
import { useModalStore } from '../stores/modal.ts';
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
  vi.stubGlobal('chrome', {
    bookmarks: { remove: vi.fn(), removeTree: vi.fn(), update: vi.fn(), create: vi.fn() },
    runtime: { lastError: undefined },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ContextMenu', () => {
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
    await vi.waitFor(() => expect(chrome.bookmarks.remove).toHaveBeenCalledWith('b1'));
  });
});
