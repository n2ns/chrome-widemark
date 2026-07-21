import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settings.ts';
import { THEME_CLASSES } from '../lib/theme.ts';

// Reflect the display settings onto <html> as CSS variables / theme classes,
// re-running whenever any of them change. Mirrors the old applySettings.
export function useApplySettings() {
  const fontSize = useSettingsStore((s) => s.fontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const theme = useSettingsStore((s) => s.theme);
  const syncTheme = useSettingsStore((s) => s.syncTheme);
  const rowSpacing = useSettingsStore((s) => s.rowSpacing);
  const uiZoom = useSettingsStore((s) => s.uiZoom);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bookmark-font-size', fontSize);
    root.style.setProperty('--bookmark-font-family', `var(--font-family-${fontFamily})`);

    root.classList.remove(...THEME_CLASSES);
    if (!syncTheme) {
      root.classList.add(`theme-${theme}`);
    }

    let padding = 'var(--bookmark-padding-medium)';
    if (rowSpacing === 'compact') padding = 'var(--bookmark-padding-compact)';
    else if (rowSpacing === 'relaxed') padding = 'var(--bookmark-padding-relaxed)';
    root.style.setProperty('--bookmark-padding', padding);
    root.style.setProperty('--ui-zoom', uiZoom || '100%');
  }, [fontSize, fontFamily, theme, syncTheme, rowSpacing, uiZoom]);
}
