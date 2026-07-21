import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSettingsStore, SETTINGS_DEFAULTS } from './settings.ts';
import { useFolderStylesStore } from './folderStyles.ts';
import { useBookmarksStore } from './bookmarks.ts';

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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('settings store', () => {
  it('hydrate merges stored values over defaults', async () => {
    vi.stubGlobal('chrome', {
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
});

describe('folderStyles store', () => {
  it('applyStorageChange ignores identical values but applies real changes', () => {
    const records = [{ dateAdded: 1, color: 'red' }];
    useFolderStylesStore.setState({ styles: records });

    useFolderStylesStore.getState().applyStorageChange([{ dateAdded: 1, color: 'red' }]);
    expect(useFolderStylesStore.getState().styles).toBe(records); // no-op: reference unchanged

    useFolderStylesStore.getState().applyStorageChange([{ dateAdded: 2, color: 'blue' }]);
    expect(useFolderStylesStore.getState().styles).toEqual([{ dateAdded: 2, color: 'blue' }]);
  });
});

describe('bookmarks store', () => {
  it('reloads on events, but suppresses during batch and import', () => {
    const getTree = vi.fn((cb: (nodes: unknown[]) => void) => cb([{ id: '0', title: '', children: [] }]));
    vi.stubGlobal('chrome', { bookmarks: { getTree } });
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
    const store = useBookmarksStore;
    store.getState().setExpanded('a', true);
    store.getState().setExpanded('b', true);
    expect([...useBookmarksStore.getState().expandedFolderIds]).toEqual(['a', 'b']);

    store.getState().setExpanded('a', false);
    expect([...useBookmarksStore.getState().expandedFolderIds]).toEqual(['b']);
  });
});
