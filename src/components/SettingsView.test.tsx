import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SettingsView } from './SettingsView.tsx';
import { ModalHost } from './ModalHost.tsx';
import { useSettingsStore, SETTINGS_DEFAULTS } from '../stores/settings.ts';
import { useModalStore } from '../stores/modal.ts';
import { useBookmarksStore } from '../stores/bookmarks.ts';
import { useFolderStylesStore } from '../stores/folderStyles.ts';
import { useOperationsStore } from '../stores/operations.ts';

beforeEach(() => {
  useSettingsStore.setState({ ...SETTINGS_DEFAULTS, hydrated: true });
  useModalStore.setState({ active: null });
  useFolderStylesStore.setState({ styles: [{ dateAdded: 1, color: 'red' }], hydrated: true });
  useOperationsStore.setState({ bookmarkMutationBusy: false, cleanupBusy: false, cleanupStatus: '' });
  useBookmarksStore.setState({
    tree: [],
    recent: [],
    expandedFolderIds: new Set(['folder']),
    loaded: true,
  });
  vi.stubGlobal('chrome', {
    runtime: { lastError: undefined },
    bookmarks: {
      getTree: vi.fn((cb: (nodes: unknown[]) => void) => cb([{ id: '0', title: '', children: [] }])),
      getRecent: vi.fn((_count: number, cb: (nodes: unknown[]) => void) => cb([])),
    },
    storage: {
      local: {
        set: vi.fn(),
        clear: vi.fn((cb: () => void) => cb()),
        get: vi.fn((_keys: string[], cb: (value: object) => void) => cb({})),
      },
      sync: {
        get: vi.fn((_keys: string[], cb: (values: object) => void) => cb({ folderStyles: [{ dateAdded: 1, color: 'red' }] })),
        remove: vi.fn((_keys: string | string[], cb?: () => void) => cb?.()),
      },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SettingsView', () => {
  it('changing the theme updates the store and persists it', () => {
    render(<SettingsView />);
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'dracula' } });
    expect(useSettingsStore.getState().theme).toBe('dracula');
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ theme: 'dracula' });
  });

  it('the theme select is disabled while Sync Theme is on', () => {
    render(<SettingsView />);
    // default syncTheme is true
    expect(screen.getByLabelText('Theme')).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Sync with Chrome / System Theme'));
    expect(useSettingsStore.getState().syncTheme).toBe(false);
    expect(screen.getByLabelText('Theme')).toBeEnabled();
  });

  it('toggling a display flag persists a boolean', () => {
    render(<SettingsView />);
    fireEvent.click(screen.getByLabelText('Show Other Bookmarks'));
    expect(useSettingsStore.getState().showOtherBookmarks).toBe(false);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ showOtherBookmarks: false });
  });

  it('Restore Defaults asks for confirmation, then clears local storage', async () => {
    render(
      <>
        <SettingsView />
        <ModalHost />
      </>
    );
    fireEvent.click(screen.getByText('Restore Defaults'));
    // Confirmation dialog (not a native confirm) appears; confirm it.
    fireEvent.click(await screen.findByText('Restore'));
    await vi.waitFor(() => expect(chrome.storage.local.clear).toHaveBeenCalled());
    await vi.waitFor(() => expect(useBookmarksStore.getState().expandedFolderIds.size).toBe(0));
  });

  it('Reset Folder Styles clears the synced style list under the mutation lock', async () => {
    render(
      <>
        <SettingsView />
        <ModalHost />
      </>
    );
    fireEvent.click(screen.getByText('Reset Folder Styles'));
    fireEvent.click(await screen.findByText('Reset'));

    await vi.waitFor(() => expect(chrome.storage.sync.remove).toHaveBeenCalledWith('folderStyles', expect.any(Function)));
    expect(useFolderStylesStore.getState().styles).toEqual([]);
    expect(useOperationsStore.getState().bookmarkMutationBusy).toBe(false);
  });
});
