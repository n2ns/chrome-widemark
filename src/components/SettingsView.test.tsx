import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SettingsView } from './SettingsView.tsx';
import { useSettingsStore, SETTINGS_DEFAULTS } from '../stores/settings.ts';

beforeEach(() => {
  useSettingsStore.setState({ ...SETTINGS_DEFAULTS, hydrated: true });
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

  it('Restore Defaults clears local storage', () => {
    render(<SettingsView />);
    fireEvent.click(screen.getByText('Restore Defaults'));
    expect(chrome.storage.local.clear).toHaveBeenCalled();
  });
});
