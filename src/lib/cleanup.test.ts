import { afterEach, describe, expect, it, vi } from 'vitest';
import { removeFoldersSequentially } from './cleanup.ts';

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
    vi.stubGlobal('chrome', { bookmarks: { remove, removeTree: vi.fn() }, runtime });
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
});
