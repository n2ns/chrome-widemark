import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ActionsView } from './ActionsView.tsx';
import { ModalHost } from './ModalHost.tsx';
import { useModalStore } from '../stores/modal.ts';
import { useOperationsStore } from '../stores/operations.ts';

const treeWithDupes = [
  {
    id: '0',
    children: [
      {
        id: '1',
        title: 'Bookmarks Bar',
        children: [
          { id: 'a', title: 'GitHub', url: 'https://github.com/' },
          { id: 'b', title: 'GitHub copy', url: 'https://github.com/' },
          { id: 'c', title: 'Other', url: 'https://other.com/' },
        ],
      },
    ],
  },
];

beforeEach(() => {
  useModalStore.setState({ active: null });
  useOperationsStore.setState({ bookmarkMutationBusy: false, cleanupBusy: false, cleanupStatus: '' });
  vi.stubGlobal('chrome', {
    bookmarks: {
      getTree: vi.fn((cb: (t: unknown[]) => void) => cb(treeWithDupes)),
      remove: vi.fn((_id: string, cb?: () => void) => cb?.()),
    },
    runtime: { lastError: undefined },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ActionsView', () => {
  it('finds exact-URL duplicates and lists the group', async () => {
    render(<ActionsView />);
    fireEvent.click(screen.getByText('Duplicate URLs'));

    // Both duplicate entries appear; the unique bookmark does not.
    expect(await screen.findByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('GitHub copy')).toBeInTheDocument();
    // URL shows as the group header and on each item.
    expect(screen.getAllByText('https://github.com/').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
    expect(screen.getByText(/Checked 3 bookmark/)).toBeInTheDocument();
  });

  it('reports when there are no empty folders', async () => {
    render(
      <>
        <ActionsView />
        <ModalHost />
      </>
    );
    fireEvent.click(screen.getByText('Empty Folders'));
    expect(await screen.findByText('No empty folders found.')).toBeInTheDocument();
  });

  it('does not offer deletion for a managed duplicate bookmark', async () => {
    const managedTree = structuredClone(treeWithDupes) as unknown as chrome.bookmarks.BookmarkTreeNode[];
    managedTree[0]!.children![0]!.children![0]!.unmodifiable = 'managed';
    vi.mocked(chrome.bookmarks.getTree).mockImplementation((cb) => cb!(managedTree));
    render(<ActionsView />);

    fireEvent.click(screen.getByText('Duplicate URLs'));

    const managedItem = (await screen.findByText('GitHub')).closest('.duplicate-item')!;
    expect(managedItem.querySelector('.duplicate-btn-delete')).toBeNull();
    expect(screen.getAllByTitle('Delete')).toHaveLength(1);
  });

  it('reports a bookmark deletion failure instead of treating it as success', async () => {
    vi.mocked(chrome.bookmarks.remove).mockImplementation((_id, cb) => {
      Object.defineProperty(chrome.runtime, 'lastError', { configurable: true, value: { message: 'Remove failed' } });
      cb?.();
      Object.defineProperty(chrome.runtime, 'lastError', { configurable: true, value: undefined });
    });
    render(
      <>
        <ActionsView />
        <ModalHost />
      </>
    );
    fireEvent.click(screen.getByText('Duplicate URLs'));
    await screen.findByText('GitHub');
    fireEvent.click(screen.getAllByTitle('Delete')[0]!);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Error')).toBeInTheDocument();
    expect(chrome.bookmarks.getTree).toHaveBeenCalledTimes(1);
  });
});
