import { create } from 'zustand';

// Panel settings and view flags, persisted to chrome.storage.local under the
// same keys the pre-React version used, so existing installs keep their prefs.
export interface SettingsState {
  fontSize: string;
  fontFamily: string;
  theme: string;
  syncTheme: boolean;
  rowSpacing: string;
  uiZoom: string;
  isSearchOpen: boolean;
  isFoldersExpanded: boolean;
  leftClickAction: string;
  dragProtectionEnabled: boolean;
  tooltipEnabled: boolean;
  showOtherBookmarks: boolean;
  showRecent: boolean;
}

export const SETTINGS_DEFAULTS: SettingsState = {
  fontSize: '14px',
  fontFamily: 'system',
  theme: 'dark',
  syncTheme: true,
  rowSpacing: 'medium',
  uiZoom: '100%',
  isSearchOpen: false,
  isFoldersExpanded: false,
  leftClickAction: 'current',
  dragProtectionEnabled: false,
  tooltipEnabled: true,
  showOtherBookmarks: true,
  showRecent: true,
};

interface SettingsStore extends SettingsState {
  hydrated: boolean;
  /** Load persisted settings from chrome.storage.local, filling gaps with defaults. */
  hydrate: () => Promise<void>;
  /** Update one setting and persist it. */
  setSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...SETTINGS_DEFAULTS,
  hydrated: false,

  hydrate: () =>
    new Promise((resolve) => {
      chrome.storage.local.get(Object.keys(SETTINGS_DEFAULTS), (result) => {
        // chrome only returns keys that exist, so absent keys keep their
        // default and a stored `false` still overrides.
        set({ ...SETTINGS_DEFAULTS, ...(result as Partial<SettingsState>), hydrated: true });
        resolve();
      });
    }),

  setSetting: (key, value) => {
    set({ [key]: value } as Partial<SettingsState>);
    chrome.storage.local.set({ [key]: value });
  },
}));
