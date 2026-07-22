import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSettingsStore, SETTINGS_DEFAULTS } from './settings.ts';
import { useFolderStylesStore } from './folderStyles.ts';
import { useBookmarksStore } from './bookmarks.ts';
import { useOperationsStore } from './operations.ts';

beforeEach(() => {
  useSettingsStore.setState({ ...SETTINGS_DEFAULTS, hydrated: false });
  useFolderStylesStore.setState({ styles: [], hydrated: false });
  useBookmarksStore.setState({
    tree: [],
    expandedFolderIds: new Set(),
    loaded: false,
    batchDepth: 0,
    isImporting: false,
  });
  useOperationsStore.setState({ bookmarkMutationBusy: false, cleanupBusy: false, cleanupStatus: '' });
});

describe('operations store', () => {
  it('serializes ordinary bookmark mutations and cleanup jobs', () => {
    const operations = useOperationsStore.getState();
    expect(operations.tryBeginMutation()).toBe(true);
    expect(useOperationsStore.getState().tryBeginCleanup()).toBe(false);
    useOperationsStore.getState().finishMutation();

    expect(useOperationsStore.getState().tryBeginCleanup()).toBe(true);
    expect(useOperationsStore.getState().tryBeginMutation()).toBe(false);
    useOperationsStore.getState().finishCleanup('Done');

    expect(useOperationsStore.getState().bookmarkMutationBusy).toBe(false);
    expect(useOperationsStore.getState().cleanupBusy).toBe(false);
    expect(useOperationsStore.getState().cleanupStatus).toBe('Done');
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('settings store', () => {
  it('hydrate merges stored values over defaults', async () => {
    vi.stubGlobal('chrome', {
      runtime: { lastError: undefined },
      storage: { local: { get: (_keys: string[], cb: (r: object) => void) => cb({ theme: 'light', showRecent: false }) } },
    });

    await useSettingsStore.getState().hydrate();
    const s = useSettingsStore.getState();

    expect(s.theme).toBe('light'); // stored override
    expect(s.showRecent).toBe(false); // stored `false` overrides default `true`
    expect(s.fontSize).toBe('14px'); // absent key keeps default
    expect(s.hydrated).toBe(true);
  });

  it('setSetting updates state and persists to storage.local', () => {
    const set = vi.fn();
    vi.stubGlobal('chrome', { storage: { local: { set } } });

    useSettingsStore.getState().setSetting('theme', 'dracula');

    expect(useSettingsStore.getState().theme).toBe('dracula');
    expect(set).toHaveBeenCalledWith({ theme: 'dracula' });
  });

  it('falls back to defaults when settings storage cannot be read', async () => {
    vi.stubGlobal('chrome', {
      runtime: { lastError: { message: 'storage unavailable' } },
      storage: { local: { get: (_keys: string[], cb: (r: object) => void) => cb({}) } },
    });

    useSettingsStore.setState({ theme: 'dracula', hydrated: false });
    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().theme).toBe(SETTINGS_DEFAULTS.theme);
    expect(useSettingsStore.getState().hydrated).toBe(true);
  });

  it('does not overwrite a setting changed while hydration is in flight', async () => {
    let finishRead: ((result: object) => void) | undefined;
    vi.stubGlobal('chrome', {
      runtime: { lastError: undefined },
      storage: {
        local: {
          get: (_keys: string[], cb: (result: object) => void) => { finishRead = cb; },
          set: vi.fn(),
        },
      },
    });

    const hydration = useSettingsStore.getState().hydrate();
    useSettingsStore.getState().setSetting('theme', 'dracula');
    finishRead?.({ theme: 'light', showRecent: false });
    await hydration;

    expect(useSettingsStore.getState().theme).toBe('dracula');
    expect(useSettingsStore.getState().showRecent).toBe(false);
  });

  it('applies settings written by another extension window', () => {
    useSettingsStore.getState().applyExternalChanges({
      theme: { oldValue: 'dark', newValue: 'light' },
      showRecent: { oldValue: true, newValue: false },
    });

    expect(useSettingsStore.getState().theme).toBe('light');
    expect(useSettingsStore.getState().showRecent).toBe(false);
  });
});

describe('folderStyles store', () => {
  it('hydrates folder styles from storage.sync', async () => {
    vi.stubGlobal('chrome', {
      runtime: { lastError: undefined },
      storage: {
        sync: {
          get: (_keys: string[], cb: (r: object) => void) => cb({
            folderStyles: [{ dateAdded: 1, color: 'red' }],
          }),
        },
      },
    });

    await useFolderStylesStore.getState().hydrate();

    expect(useFolderStylesStore.getState().styles).toEqual([
      { dateAdded: 1, color: 'red' },
    ]);
    expect(useFolderStylesStore.getState().hydrated).toBe(true);
  });

  it('keeps the last good styles when a reload fails', async () => {
    const records = [{ dateAdded: 1, color: 'red' }];
    useFolderStylesStore.setState({ styles: records, hydrated: true });
    vi.stubGlobal('chrome', {
      runtime: { lastError: { message: 'storage unavailable' } },
      storage: { sync: { get: (_keys: string[], cb: (r: object) => void) => cb({}) } },
    });

    await useFolderStylesStore.getState().reload();

    expect(useFolderStylesStore.getState().styles).toBe(records);
  });

  it('prevents an older reload from overwriting a newer snapshot', async () => {
    const callbacks: Array<(result: Record<string, unknown>) => void> = [];
    vi.stubGlobal('chrome', {
      runtime: { lastError: undefined },
      storage: { sync: { get: (_keys: string[], cb: (result: Record<string, unknown>) => void) => callbacks.push(cb) } },
    });

    const older = useFolderStylesStore.getState().reload();
    const newer = useFolderStylesStore.getState().reload();
    callbacks[1]!({ folderStyles: [{ dateAdded: 2, color: 'blue' }] });
    callbacks[0]!({ folderStyles: [{ dateAdded: 1, color: 'red' }] });
    await Promise.all([older, newer]);

    expect(useFolderStylesStore.getState().styles).toEqual([
      { dateAdded: 2, color: 'blue' },
    ]);
  });
});

describe('bookmarks store', () => {
  it('reloads on events, but suppresses during batch and import', () => {
    const getTree = vi.fn((cb: (nodes: unknown[]) => void) => cb([{ id: '0', title: '', children: [] }]));
    const getRecent = vi.fn((_count: number, cb: (nodes: unknown[]) => void) => cb([]));
    vi.stubGlobal('chrome', { bookmarks: { getTree, getRecent }, runtime: { lastError: undefined } });
    const store = useBookmarksStore;

    store.getState().onBookmarkEvent();
    expect(getTree).toHaveBeenCalledTimes(1);

    store.getState().beginBatch();
    store.getState().onBookmarkEvent();
    expect(getTree).toHaveBeenCalledTimes(1); // suppressed during batch
    store.getState().endBatch(); // returns to 0 → one reload
    expect(getTree).toHaveBeenCalledTimes(2);

    store.getState().onImportBegan();
    store.getState().onBookmarkEvent();
    expect(getTree).toHaveBeenCalledTimes(2); // suppressed during import
    store.getState().onImportEnded(); // reload once at import end
    expect(getTree).toHaveBeenCalledTimes(3);
  });

  it('setExpanded adds and removes folder ids immutably', () => {
    vi.stubGlobal('chrome', { storage: { local: { set: vi.fn() } } });
    const store = useBookmarksStore;
    store.getState().setExpanded('a', true);
    store.getState().setExpanded('b', true);
    expect([...useBookmarksStore.getState().expandedFolderIds]).toEqual(['a', 'b']);

    store.getState().setExpanded('a', false);
    expect([...useBookmarksStore.getState().expandedFolderIds]).toEqual(['b']);
  });

  it('keeps the newest bookmark reload when callbacks finish out of order', async () => {
    const callbacks: Array<(nodes: unknown[]) => void> = [];
    const getTree = vi.fn((cb: (nodes: unknown[]) => void) => callbacks.push(cb));
    const getRecent = vi.fn((_count: number, cb: (nodes: unknown[]) => void) => cb([]));
    vi.stubGlobal('chrome', { bookmarks: { getTree, getRecent }, runtime: { lastError: undefined } });

    const older = useBookmarksStore.getState().reload();
    const newer = useBookmarksStore.getState().reload();
    callbacks[1]!([{ id: 'new', title: 'New tree' }]);
    callbacks[0]!([{ id: 'old', title: 'Old tree' }]);
    await Promise.all([older, newer]);

    expect(useBookmarksStore.getState().tree[0]?.id).toBe('new');
  });
});
