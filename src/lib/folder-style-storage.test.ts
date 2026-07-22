import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearFolderStyleRecords,
  loadFolderStyleRecords,
  saveFolderStyleRecord,
} from './folder-style-storage.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubSync(initial: unknown = []) {
  let folderStyles = initial;
  const set = vi.fn((updates: { folderStyles?: unknown }, callback?: () => void) => {
    if ('folderStyles' in updates) folderStyles = structuredClone(updates.folderStyles);
    callback?.();
  });
  const remove = vi.fn((_key: string, callback?: () => void) => {
    folderStyles = undefined;
    callback?.();
  });
  vi.stubGlobal('chrome', {
    runtime: { lastError: undefined },
    storage: {
      sync: {
        get: (_keys: string[], callback: (result: { folderStyles?: unknown }) => void) => callback({
          folderStyles: structuredClone(folderStyles),
        }),
        set,
        remove,
      },
    },
  });
  return { get value() { return folderStyles; }, set, remove };
}

describe('folder style sync storage', () => {
  it('loads the folderStyles array', async () => {
    stubSync([{ dateAdded: 1, title: 'One', path: ['One'], color: 'red' }]);

    expect(await loadFolderStyleRecords()).toEqual([
      { dateAdded: 1, title: 'One', path: ['One'], color: 'red' },
    ]);
  });

  it('adds and updates a folder style', async () => {
    const sync = stubSync([]);
    const identity = { id: '1', dateAdded: 1, title: 'One', path: ['One'] };
    const added = await saveFolderStyleRecord(null, identity, { color: 'red', icon: 'star' });

    expect(added).toEqual({ dateAdded: 1, title: 'One', path: ['One'], color: 'red', icon: 'star' });
    await saveFolderStyleRecord(added, identity, { color: 'blue', icon: 'heart' });
    expect(sync.value).toEqual([
      { dateAdded: 1, title: 'One', path: ['One'], color: 'blue', icon: 'heart' },
    ]);
  });

  it('removes a folder style when Default is selected', async () => {
    const existing = { dateAdded: 1, title: 'One', path: ['One'], color: 'red' };
    const sync = stubSync([existing]);

    expect(await saveFolderStyleRecord(existing, { id: '1', dateAdded: 1, title: 'One', path: ['One'] }, {
      color: '', icon: 'default',
    })).toBeNull();
    expect(sync.value).toEqual([]);
  });

  it('replaces the pre-rename record and does not restore it after Default', async () => {
    const sync = stubSync([{ dateAdded: 2, title: 'Old', path: ['Old'], color: 'red' }]);
    const existing = (await loadFolderStyleRecords())[0];
    const renamed = { id: '2', dateAdded: 2, title: 'New', path: ['New'] };

    const saved = await saveFolderStyleRecord(existing, renamed, { color: 'blue' });
    expect(sync.value).toEqual([
      { dateAdded: 2, title: 'New', path: ['New'], color: 'blue', icon: 'default' },
    ]);

    await saveFolderStyleRecord(saved, renamed, { color: '', icon: 'default' });
    expect(sync.value).toEqual([]);
  });

  it('clears all folder styles', async () => {
    const sync = stubSync([{ dateAdded: 1, color: 'red' }]);

    await clearFolderStyleRecords();

    expect(sync.remove).toHaveBeenCalledWith('folderStyles', expect.any(Function));
    expect(sync.value).toBeUndefined();
  });
});
