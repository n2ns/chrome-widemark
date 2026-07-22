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
  /** Apply changes written by another extension page/window. */
  applyExternalChanges: (changes: Record<string, chrome.storage.StorageChange>) => void;
}

const SETTING_KEYS = Object.keys(SETTINGS_DEFAULTS) as (keyof SettingsState)[];
const settingVersions = Object.fromEntries(SETTING_KEYS.map((key) => [key, 0])) as Record<keyof SettingsState, number>;
let hydrationGeneration = 0;

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...SETTINGS_DEFAULTS,
  hydrated: false,

  hydrate: () => {
    const generation = ++hydrationGeneration;
    const versionsAtStart = { ...settingVersions };
    return (
    new Promise((resolve) => {
      chrome.storage.local.get(SETTING_KEYS, (result) => {
        if (generation !== hydrationGeneration) {
          resolve();
          return;
        }
        const next = chrome.runtime.lastError
          ? { ...SETTINGS_DEFAULTS }
          : { ...SETTINGS_DEFAULTS, ...(result as Partial<SettingsState>) };
        // Do not overwrite an interaction or a storage event that happened
        // while the asynchronous initial read was in flight.
        for (const key of SETTING_KEYS) {
          if (settingVersions[key] !== versionsAtStart[key]) {
            (next as Record<keyof SettingsState, SettingsState[keyof SettingsState]>)[key] = get()[key];
          }
        }
        if (chrome.runtime.lastError) {
          set({ ...next, hydrated: true });
          resolve();
          return;
        }
        set({ ...next, hydrated: true });
        resolve();
      });
    })
    );
  },

  setSetting: (key, value) => {
    settingVersions[key] += 1;
    set({ [key]: value } as Partial<SettingsState>);
    chrome.storage.local.set({ [key]: value });
  },

  applyExternalChanges: (changes) => {
    const next: Partial<SettingsState> = {};
    for (const key of SETTING_KEYS) {
      const change = changes[key];
      if (!change) continue;
      settingVersions[key] += 1;
      (next as Record<keyof SettingsState, SettingsState[keyof SettingsState]>)[key] =
        change.newValue === undefined ? SETTINGS_DEFAULTS[key] : change.newValue as SettingsState[typeof key];
    }
    if (Object.keys(next).length > 0) set(next);
  },
}));
