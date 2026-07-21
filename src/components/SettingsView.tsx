import type { ReactNode } from 'react';
import { useSettingsStore } from '../stores/settings.ts';
import { useFolderStylesStore } from '../stores/folderStyles.ts';
import { useBookmarksStore } from '../stores/bookmarks.ts';

const THEME_OPTIONS = [
  ['light', 'Light'],
  ['dark', 'Dark'],
  ['one-dark-pro', 'Blue Gray'],
  ['dracula', 'Graphite'],
  ['github-dark', 'Slate'],
  ['everforest', 'Olive'],
  ['gruvbox', 'Sepia'],
];
const FONT_SIZE_OPTIONS = [
  ['12px', 'Small (12px)'],
  ['14px', 'Medium (14px)'],
  ['16px', 'Large (16px)'],
  ['18px', 'Extra Large (18px)'],
];
const FONT_FAMILY_OPTIONS = [
  ['system', 'System Default'],
  ['sans-serif', 'Sans-Serif (YaHei / Arial)'],
  ['serif', 'Serif (SimSun / Georgia)'],
  ['monospace', 'Monospace (Consolas / Courier)'],
];
const ROW_SPACING_OPTIONS = [
  ['compact', 'Compact (Tight)'],
  ['medium', 'Standard (Medium)'],
  ['relaxed', 'Relaxed (Spacious)'],
];
const UI_ZOOM_OPTIONS = [
  ['80%', '80%'],
  ['90%', '90%'],
  ['100%', '100%'],
  ['110%', '110%'],
  ['120%', '120%'],
];
const LEFT_CLICK_OPTIONS = [
  ['current', 'Open in Current Tab'],
  ['new-foreground', 'Open in New Tab & Activate'],
  ['new-background', 'Open in New Tab (Background)'],
];

function SelectRow({
  id,
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[][];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="settings-group">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optValue, optLabel]) => (
          <option key={optValue} value={optValue}>
            {optLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function CheckboxRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="settings-group checkbox-group">
      <input type="checkbox" id={id} checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="settings-card">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function SettingsView() {
  const s = useSettingsStore();
  const set = s.setSetting;

  const resetFolderStyles = () => {
    chrome.storage.sync.remove('folderStyles', () => {
      useFolderStylesStore.getState().setStyles([]);
    });
  };

  const restoreDefaults = () => {
    chrome.storage.local.clear(() => {
      void useSettingsStore.getState().hydrate();
      void useBookmarksStore.getState().reload();
    });
  };

  return (
    <div id="settings-view">
      <Card title="Display">
        <SelectRow id="setting-theme" label="Theme" value={s.theme} options={THEME_OPTIONS} disabled={s.syncTheme} onChange={(v) => set('theme', v)} />
        <CheckboxRow id="setting-sync-theme" label="Sync with Chrome / System Theme" checked={s.syncTheme} onChange={(v) => set('syncTheme', v)} />
        <CheckboxRow id="setting-show-other" label="Show Other Bookmarks" checked={s.showOtherBookmarks} onChange={(v) => set('showOtherBookmarks', v)} />
        <CheckboxRow id="setting-show-recent" label="Show Recently Added Section" checked={s.showRecent} onChange={(v) => set('showRecent', v)} />
        <SelectRow id="setting-font-size" label="Font Size" value={s.fontSize} options={FONT_SIZE_OPTIONS} onChange={(v) => set('fontSize', v)} />
        <SelectRow id="setting-font-family" label="Font Family" value={s.fontFamily} options={FONT_FAMILY_OPTIONS} onChange={(v) => set('fontFamily', v)} />
        <SelectRow id="setting-row-spacing" label="Row Spacing" value={s.rowSpacing} options={ROW_SPACING_OPTIONS} onChange={(v) => set('rowSpacing', v)} />
        <SelectRow id="setting-ui-zoom" label="UI Zoom Level" value={s.uiZoom} options={UI_ZOOM_OPTIONS} onChange={(v) => set('uiZoom', v)} />
      </Card>

      <Card title="Behavior">
        <SelectRow id="setting-left-click-action" label="Left-click Action" value={s.leftClickAction} options={LEFT_CLICK_OPTIONS} onChange={(v) => set('leftClickAction', v)} />
        <CheckboxRow id="setting-drag-protection" label="Drag Protection (Disable reordering)" checked={s.dragProtectionEnabled} onChange={(v) => set('dragProtectionEnabled', v)} />
        <CheckboxRow id="setting-tooltip-enabled" label="Enable URL Hover Tooltips" checked={s.tooltipEnabled} onChange={(v) => set('tooltipEnabled', v)} />
      </Card>

      <Card title="System">
        <div className="settings-actions-column">
          <button className="modal-btn warning-btn" onClick={resetFolderStyles}>
            Reset Folder Styles
          </button>
          <button className="modal-btn danger-btn" onClick={restoreDefaults}>
            Restore Defaults
          </button>
        </div>
      </Card>
    </div>
  );
}
