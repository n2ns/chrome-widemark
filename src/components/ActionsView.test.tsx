import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ActionsView } from './ActionsView.tsx';
import { ModalHost } from './ModalHost.tsx';
import { useModalStore } from '../stores/modal.ts';

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
});
