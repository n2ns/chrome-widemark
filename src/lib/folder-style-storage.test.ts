import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearFolderStyleRecords,
  loadFolderStyleRecords,
  saveFolderStyleRecord,
} from './folder-style-storage.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubSync(initial: unknown = [], extra: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = { folderStyles: initial, ...extra };
  const runtime: { lastError: { message: string } | undefined } = { lastError: undefined };
  const fail = (message: string, callback?: () => void) => {
    runtime.lastError = { message };
    callback?.();
    runtime.lastError = undefined;
  };
  const set = vi.fn((updates: Record<string, unknown>, callback?: () => void) => {
    if (Object.entries(updates).some(([key, value]) => new TextEncoder().encode(key + JSON.stringify(value)).length > 8192)) {
      fail('QUOTA_BYTES_PER_ITEM quota exceeded', callback);
      return;
    }
    Object.assign(values, structuredClone(updates));
    callback?.();
  });
  const remove = vi.fn((keys: string | string[], callback?: () => void) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
    callback?.();
  });
  vi.stubGlobal('chrome', {
    runtime,
    storage: {
      sync: {
        get: (_keys: string[] | undefined, callback: (result: Record<string, unknown>) => void) => callback(structuredClone(values)),
        set,
        remove,
      },
    },
  });
  return {
    values, set, remove, fail,
    get value() {
      const index = values.folderStyles;
      if (!index || Array.isArray(index)) return index;
      return Array.from({ length: (index as { chunkCount: number }).chunkCount }, (_, i) =>
        (values[`folderStyles:${i}`] as { records: unknown[] }).records
      ).flat();
    },
  };
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

    expect(sync.remove).toHaveBeenCalledWith(['folderStyles'], expect.any(Function));
    expect(sync.value).toBeUndefined();
  });

  it('migrates the legacy array on a successful edit without losing other records', async () => {
    const old = { dateAdded: 1, title: 'One', path: ['One'], color: 'red' };
    const sync = stubSync([old], { unrelated: 'keep' });

    await saveFolderStyleRecord(null, { id: '2', dateAdded: 2, title: 'Two', path: ['Two'] }, { color: 'blue' });

    expect(sync.values.folderStyles).toMatchObject({ version: 2, chunkCount: 1 });
    expect(await loadFolderStyleRecords()).toEqual([
      old, { dateAdded: 2, title: 'Two', path: ['Two'], color: 'blue', icon: 'default' },
    ]);
    expect(sync.values.unrelated).toBe('keep');
  });

  it('stores more than 8 KB of styles while respecting every item quota, including Unicode paths', async () => {
    const sync = stubSync([]);
    for (let i = 0; i < 100; i += 1) {
      const title = `项目文件夹 ${i}`;
      await saveFolderStyleRecord(null, {
        id: String(i), dateAdded: 1700000000000 + i, title, path: ['工作资料', '长期项目', title],
      }, { color: '#ff0000', icon: 'star' });
    }

    const loaded = await loadFolderStyleRecords();
    expect(loaded).toHaveLength(100);
    expect(new TextEncoder().encode(JSON.stringify(loaded)).length).toBeGreaterThan(8192);
    expect((sync.values.folderStyles as { chunkCount: number }).chunkCount).toBeGreaterThan(1);
    for (const [key, value] of Object.entries(sync.values)) {
      expect(new TextEncoder().encode(key + JSON.stringify(value)).length).toBeLessThanOrEqual(8192);
    }
  });

  it('preserves the legacy snapshot if migration fails', async () => {
    const initial = [{ dateAdded: 1, title: 'One', path: ['One'], color: 'red' }];
    const sync = stubSync(initial);
    sync.set.mockImplementationOnce((_updates, callback) => sync.fail('write failed', callback));

    await expect(saveFolderStyleRecord(null, { id: '2', dateAdded: 2, title: 'Two' }, { color: 'blue' }))
      .rejects.toThrow('write failed');

    expect(sync.values).toEqual({ folderStyles: initial });
    expect(sync.remove).not.toHaveBeenCalled();
    expect(await loadFolderStyleRecords()).toEqual(initial);
  });

  it('preserves the previous chunks if saving a new snapshot fails', async () => {
    const sync = stubSync([]);
    const identity = { id: '1', dateAdded: 1, title: 'One', path: ['One'] };
    const record = await saveFolderStyleRecord(null, identity, { color: 'red' });
    const before = structuredClone(sync.values);
    sync.set.mockImplementationOnce((_updates, callback) => sync.fail('write failed', callback));

    await expect(saveFolderStyleRecord(record, identity, { color: 'blue' })).rejects.toThrow('write failed');

    expect(sync.values).toEqual(before);
    expect(await loadFolderStyleRecords()).toEqual([record]);
  });

  it('refuses incomplete or mixed snapshots instead of allowing a destructive partial save', async () => {
    const sync = stubSync({ version: 2, revision: 'new', chunkCount: 2 }, {
      'folderStyles:0': { revision: 'new', records: [{ dateAdded: 1, color: 'red' }] },
    });

    await expect(loadFolderStyleRecords()).rejects.toThrow('Incomplete');
    await expect(saveFolderStyleRecord(null, { id: '3', dateAdded: 3 }, { color: 'blue' })).rejects.toThrow('Incomplete');
    expect(sync.set).not.toHaveBeenCalled();

    sync.values['folderStyles:1'] = { revision: 'old', records: [{ dateAdded: 2, color: 'green' }] };
    await expect(loadFolderStyleRecords()).rejects.toThrow('Incomplete');

    delete sync.values.folderStyles;
    await expect(loadFolderStyleRecords()).rejects.toThrow('Incomplete');
  });

  it('rejects one oversized record before modifying stored data', async () => {
    const initial = [{ dateAdded: 1, color: 'red' }];
    const sync = stubSync(initial);

    await expect(saveFolderStyleRecord(null, { id: '2', dateAdded: 2, title: '很长'.repeat(2000) }, { color: 'blue' }))
      .rejects.toThrow('item quota');

    expect(sync.set).not.toHaveBeenCalled();
    expect(await loadFolderStyleRecords()).toEqual(initial);
  });

  it('removes obsolete chunks after Default and keeps the committed result if cleanup fails', async () => {
    const existing = { dateAdded: 1, title: 'One', path: ['One'], color: 'red' };
    const sync = stubSync({ version: 2, revision: 'old', chunkCount: 1 }, {
      'folderStyles:0': { revision: 'old', records: [existing] },
    });
    sync.remove.mockImplementationOnce((_keys, callback) => sync.fail('cleanup failed', callback));

    await saveFolderStyleRecord(existing, { id: '1', ...existing }, { color: '', icon: 'default' });

    expect(await loadFolderStyleRecords()).toEqual([]);
    expect(sync.remove).toHaveBeenCalledWith(['folderStyles:0'], expect.any(Function));
    expect(sync.values['folderStyles:0']).toBeDefined();
    await clearFolderStyleRecords();
    expect(sync.values).toEqual({});
  });

  it('clears both formats and all chunks without touching unrelated sync data', async () => {
    const sync = stubSync({ version: 2, revision: 'old', chunkCount: 1 }, {
      'folderStyles:0': { revision: 'old', records: [{ dateAdded: 1, color: 'red' }] },
      'folderStyles:1': { revision: 'obsolete', records: [] },
      unrelated: 'keep',
    });

    await clearFolderStyleRecords();

    expect(sync.values).toEqual({ unrelated: 'keep' });
    expect(await loadFolderStyleRecords()).toEqual([]);
  });

  it('keeps stored styles when clearing fails', async () => {
    const initial = [{ dateAdded: 1, color: 'red' }];
    const sync = stubSync(initial);
    sync.remove.mockImplementationOnce((_keys, callback) => sync.fail('remove failed', callback));

    await expect(clearFolderStyleRecords()).rejects.toThrow('remove failed');

    expect(await loadFolderStyleRecords()).toEqual(initial);
  });
});
