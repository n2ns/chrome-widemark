import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useBookmarksStore } from './bookmarks.ts';

describe('Chrome subscriptions', () => {
  beforeEach(() => {
    vi.resetModules();
    useBookmarksStore.setState({ batchDepth: 0, isImporting: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listens for native child reordering and initializes only once', async () => {
    const events = {
      onImportBegan: { addListener: vi.fn() },
      onImportEnded: { addListener: vi.fn() },
      onCreated: { addListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
      onChanged: { addListener: vi.fn() },
      onMoved: { addListener: vi.fn() },
      onChildrenReordered: { addListener: vi.fn() },
    };
    vi.stubGlobal('chrome', {
      bookmarks: events,
      storage: { onChanged: { addListener: vi.fn() } },
    });

    const { initChromeSubscriptions } = await import('./subscriptions.ts');
    initChromeSubscriptions();
    initChromeSubscriptions();

    expect(events.onChildrenReordered.addListener).toHaveBeenCalledTimes(1);
    expect(events.onCreated.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.storage.onChanged.addListener).toHaveBeenCalledTimes(1);
  });

  it('reloads folder styles for both legacy and chunk changes, but not unrelated storage', async () => {
    const event = () => ({ addListener: vi.fn() });
    vi.stubGlobal('chrome', {
      bookmarks: {
        onImportBegan: event(), onImportEnded: event(), onCreated: event(),
        onRemoved: event(), onChanged: event(), onMoved: event(), onChildrenReordered: event(),
      },
      storage: { onChanged: event() },
    });
    const { useFolderStylesStore } = await import('./folderStyles.ts');
    const reload = vi.fn(async () => undefined);
    useFolderStylesStore.setState({ reload });
    const { initChromeSubscriptions } = await import('./subscriptions.ts');
    initChromeSubscriptions();
    const listener = vi.mocked(chrome.storage.onChanged.addListener).mock.calls[0]![0];

    listener({ folderStyles: { newValue: [] } }, 'sync');
    listener({ 'folderStyles:0': { newValue: { records: [] } } }, 'sync');
    listener({ 'folderStyles:1': { oldValue: { records: [] } } }, 'sync');
    listener({ unrelated: { newValue: true } }, 'sync');
    listener({ 'folderStyles:0': { newValue: {} } }, 'local');

    expect(reload).toHaveBeenCalledTimes(3);
  });
});
