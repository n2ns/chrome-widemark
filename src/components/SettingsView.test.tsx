import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SettingsView } from './SettingsView.tsx';
import { ModalHost } from './ModalHost.tsx';
import { useSettingsStore, SETTINGS_DEFAULTS } from '../stores/settings.ts';
import { useModalStore } from '../stores/modal.ts';

beforeEach(() => {
  useSettingsStore.setState({ ...SETTINGS_DEFAULTS, hydrated: true });
  useModalStore.setState({ active: null });
  vi.stubGlobal('chrome', {
    storage: { local: { set: vi.fn(), clear: vi.fn() }, sync: { remove: vi.fn() } },
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
  });
});
