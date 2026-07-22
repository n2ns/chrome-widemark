import type { ReactNode } from 'react';
import { useSettingsStore } from '../stores/settings.ts';
import { useFolderStylesStore } from '../stores/folderStyles.ts';
import { useBookmarksStore } from '../stores/bookmarks.ts';
import { useModalStore } from '../stores/modal.ts';
import { useOperationsStore } from '../stores/operations.ts';
import { t } from '../lib/i18n.ts';
import type { MessageKey } from '../lib/message-catalog.ts';
import { clearFolderStyleRecords } from '../lib/folder-style-storage.ts';
import { withGlobalBookmarkMutation } from '../lib/bookmark-mutation-lock.ts';

type SelectOption = { value: string; labelKey?: MessageKey; label?: string };

const THEME_OPTIONS: SelectOption[] = [
  { value: 'light', labelKey: 'option_theme_light' },
  { value: 'dark', labelKey: 'option_theme_dark' },
  { value: 'one-dark-pro', labelKey: 'option_theme_blue_gray' },
  { value: 'dracula', labelKey: 'option_theme_graphite' },
  { value: 'github-dark', labelKey: 'option_theme_slate' },
  { value: 'everforest', labelKey: 'option_theme_olive' },
  { value: 'gruvbox', labelKey: 'option_theme_sepia' },
];
const FONT_SIZE_OPTIONS: SelectOption[] = [
  { value: '12px', labelKey: 'option_font_small' },
  { value: '14px', labelKey: 'option_font_medium' },
  { value: '16px', labelKey: 'option_font_large' },
  { value: '18px', labelKey: 'option_font_extra_large' },
];
const FONT_FAMILY_OPTIONS: SelectOption[] = [
  { value: 'system', labelKey: 'option_font_system' },
  { value: 'sans-serif', labelKey: 'option_font_sans' },
  { value: 'serif', labelKey: 'option_font_serif' },
  { value: 'monospace', labelKey: 'option_font_mono' },
];
const ROW_SPACING_OPTIONS: SelectOption[] = [
  { value: 'compact', labelKey: 'option_spacing_compact' },
  { value: 'medium', labelKey: 'option_spacing_medium' },
  { value: 'relaxed', labelKey: 'option_spacing_relaxed' },
];
const UI_ZOOM_OPTIONS: SelectOption[] = ['80%', '90%', '100%', '110%', '120%'].map((value) => ({ value, label: value }));
const LEFT_CLICK_OPTIONS: SelectOption[] = [
  { value: 'current', labelKey: 'option_open_current' },
  { value: 'new-foreground', labelKey: 'option_open_foreground' },
  { value: 'new-background', labelKey: 'option_open_background' },
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
  options: SelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="settings-group">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.labelKey ? t(option.labelKey) : option.label}
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
  const mutationBusy = useOperationsStore((state) => state.bookmarkMutationBusy);

  const resetFolderStyles = async () => {
    const ok = await useModalStore.getState().showConfirmDialog({
      title: t('settings_reset_styles'),
      message: t('settings_reset_styles_message'),
      confirmLabel: t('common_reset'),
    });
    if (!ok) return;
    const operations = useOperationsStore.getState();
    if (!operations.tryBeginMutation()) return;
    try {
      await withGlobalBookmarkMutation(clearFolderStyleRecords);
      useFolderStylesStore.getState().setStyles([]);
    } catch {
      await useModalStore.getState().showInfoDialog({
        title: t('common_error'),
        message: t('common_storage_error'),
      });
    } finally {
      operations.finishMutation();
    }
  };

  const restoreDefaults = async () => {
    const ok = await useModalStore.getState().showConfirmDialog({
      title: t('settings_restore_defaults'),
      message: t('settings_restore_defaults_message'),
      confirmLabel: t('common_restore'),
    });
    if (!ok) return;
    chrome.storage.local.clear(() => {
      void useSettingsStore.getState().hydrate();
      void useBookmarksStore.getState().hydrateExpanded();
      void useBookmarksStore.getState().reload();
    });
  };

  return (
    <div id="settings-view">
      <Card title={t('settings_display')}>
        <SelectRow id="setting-theme" label={t('settings_theme')} value={s.theme} options={THEME_OPTIONS} disabled={s.syncTheme} onChange={(v) => set('theme', v)} />
        <CheckboxRow id="setting-sync-theme" label={t('settings_sync_theme')} checked={s.syncTheme} onChange={(v) => set('syncTheme', v)} />
        <CheckboxRow id="setting-show-other" label={t('settings_show_other')} checked={s.showOtherBookmarks} onChange={(v) => set('showOtherBookmarks', v)} />
        <CheckboxRow id="setting-show-recent" label={t('settings_show_recent')} checked={s.showRecent} onChange={(v) => set('showRecent', v)} />
        <SelectRow id="setting-font-size" label={t('settings_font_size')} value={s.fontSize} options={FONT_SIZE_OPTIONS} onChange={(v) => set('fontSize', v)} />
        <SelectRow id="setting-font-family" label={t('settings_font_family')} value={s.fontFamily} options={FONT_FAMILY_OPTIONS} onChange={(v) => set('fontFamily', v)} />
        <SelectRow id="setting-row-spacing" label={t('settings_row_spacing')} value={s.rowSpacing} options={ROW_SPACING_OPTIONS} onChange={(v) => set('rowSpacing', v)} />
        <SelectRow id="setting-ui-zoom" label={t('settings_ui_zoom')} value={s.uiZoom} options={UI_ZOOM_OPTIONS} onChange={(v) => set('uiZoom', v)} />
      </Card>

      <Card title={t('settings_behavior')}>
        <SelectRow id="setting-left-click-action" label={t('settings_left_click')} value={s.leftClickAction} options={LEFT_CLICK_OPTIONS} onChange={(v) => set('leftClickAction', v)} />
        <CheckboxRow id="setting-drag-protection" label={t('settings_drag_protection')} checked={s.dragProtectionEnabled} onChange={(v) => set('dragProtectionEnabled', v)} />
        <CheckboxRow id="setting-tooltip-enabled" label={t('settings_tooltips')} checked={s.tooltipEnabled} onChange={(v) => set('tooltipEnabled', v)} />
      </Card>

      <Card title={t('settings_system')}>
        <div className="settings-actions-column">
          <button className="modal-btn warning-btn" disabled={mutationBusy} onClick={resetFolderStyles}>
            {t('settings_reset_styles')}
          </button>
          <button className="modal-btn danger-btn" onClick={restoreDefaults}>
            {t('settings_restore_defaults')}
          </button>
        </div>
      </Card>
    </div>
  );
}
