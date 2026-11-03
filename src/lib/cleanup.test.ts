import { afterEach, describe, expect, it, vi } from 'vitest';
import { removeFoldersSequentially } from './cleanup.ts';
import { findEmptyFolders } from './bookmark-utils.ts';
import type { BookmarkNode } from '../types.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('removeFoldersSequentially', () => {
  it('uses empty-only removal and reports only successful deletions', async () => {
    const runtime: { lastError?: { message: string } } = {};
    const remove = vi.fn((id: string, callback: () => void) => {
      runtime.lastError = id === 'became-nonempty' ? { message: 'Folder is not empty.' } : undefined;
      callback();
      runtime.lastError = undefined;
    });
    const getSubTree = vi.fn((id: string, callback: (tree: object[]) => void) => {
      callback([{ id, title: id, children: [] }]);
    });
    vi.stubGlobal('chrome', { bookmarks: { getSubTree, remove, removeTree: vi.fn() }, runtime });
    const beginBatch = vi.fn();
    const endBatch = vi.fn();

    const removed = await new Promise<number>((resolve) => {
      removeFoldersSequentially(['empty', 'became-nonempty'], { beginBatch, endBatch }, resolve);
    });

    expect(remove).toHaveBeenCalledTimes(2);
    expect(chrome.bookmarks.removeTree).not.toHaveBeenCalled();
    expect(beginBatch).toHaveBeenCalledTimes(1);
    expect(endBatch).toHaveBeenCalledTimes(1);
    expect(removed).toBe(1);
  });

  it.each(['unchanged', 'before revalidation', 'during deletion'] as const)(
    'cleans nested empty folders safely when content is %s',
    async (change) => {
      const inner: BookmarkNode = { id: '11', title: 'Inner', syncing: false, children: [] };
      const outer: BookmarkNode = { id: '10', title: 'Outer', syncing: false, children: [inner] };
      const untouched: BookmarkNode = { id: '20', title: 'Other', syncing: false, children: [{ id: '21', title: 'Keep', syncing: false, url: 'https://keep.example/' }] };
      const bar: BookmarkNode = { id: '1', title: 'Bookmarks Bar', syncing: false, children: [outer, untouched] };
      const tree: BookmarkNode[] = [{ id: '0', title: '', syncing: false, children: [bar] }];
      const confirmedIds = findEmptyFolders(tree).map((folder) => folder.id);
      expect(confirmedIds).toEqual(['10']);

      const added: BookmarkNode = { id: '12', title: 'Added', syncing: false, url: 'https://added.example/' };
      const runtime: { lastError?: { message: string } } = {};
      const getSubTree = vi.fn((_id: string, callback: (nodes: BookmarkNode[]) => void) => {
        if (change === 'before revalidation') outer.children!.push(added);
        callback(structuredClone([outer]));
      });
      const remove = vi.fn((id: string, callback: () => void) => {
        if (change === 'during deletion' && id === inner.id) inner.children!.push(added);
        const parent = id === inner.id ? outer : bar;
        const node = parent.children!.find((child) => child.id === id)!;
        if (node.children!.length > 0) {
          runtime.lastError = { message: 'Folder is not empty.' };
        } else {
          parent.children = parent.children!.filter((child) => child.id !== id);
        }
        callback();
        runtime.lastError = undefined;
      });
      vi.stubGlobal('chrome', { bookmarks: { getSubTree, remove, removeTree: vi.fn() }, runtime });
      const beginBatch = vi.fn();
      const endBatch = vi.fn();

      const removed = await new Promise<number>((resolve) => {
        removeFoldersSequentially(confirmedIds, { beginBatch, endBatch }, resolve);
      });

      expect(removed).toBe(change === 'unchanged' ? 1 : 0);
      expect(remove.mock.calls.map(([id]) => id)).toEqual(change === 'before revalidation' ? [] : ['11', '10']);
      expect(bar.children).toEqual(change === 'unchanged' ? [untouched] : [outer, untouched]);
      if (change === 'before revalidation') expect(outer.children).toContain(added);
      if (change === 'during deletion') expect(inner.children).toContain(added);
      expect(chrome.bookmarks.removeTree).not.toHaveBeenCalled();
      expect(beginBatch).toHaveBeenCalledTimes(1);
      expect(endBatch).toHaveBeenCalledTimes(1);
    },
  );
});
