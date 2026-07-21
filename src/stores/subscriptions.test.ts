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
});
