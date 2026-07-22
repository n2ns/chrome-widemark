import { t } from '../lib/i18n.ts';
import type { MessageKey } from '../lib/message-catalog.ts';

const HELP_SECTIONS: [MessageKey, MessageKey[]][] = [
  [
    'help_basics',
    [
      'help_basics_folder',
      'help_basics_search',
      'help_basics_background',
      'help_basics_keyboard',
      'help_basics_shortcut',
    ],
  ],
  [
    'help_organize',
    [
      'help_organize_menu',
      'help_organize_sort',
      'help_organize_drag',
      'help_organize_styles',
    ],
  ],
  [
    'common_actions',
    [
      'help_actions_duplicates',
      'help_actions_cleanup',
      'help_actions_review',
      'help_actions_confirm',
    ],
  ],
  [
    'common_settings',
    ['help_settings_adjust', 'help_settings_restore'],
  ],
  [
    'help_privacy',
    [
      'help_privacy_permissions',
      'help_privacy_tracking',
      'help_privacy_upload',
      'help_privacy_local',
    ],
  ],
];

export function HelpView() {
  return (
    <div id="help-view">
      <div className="settings-card">
        <h3>{t('common_help')}</h3>
        <div className="help-list">
          {HELP_SECTIONS.map(([heading, items]) => (
            <section className="help-item" key={heading}>
              <h4>{t(heading)}</h4>
              <ul>
                {items.map((item) => (
                  <li key={item}>{t(item)}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
      <div className="settings-card help-about-card">
        <h3>{t('help_about')}</h3>
        <p>
          {t('help_built_by')}{' '}
          <a href="https://n2ns.com" target="_blank" rel="noopener noreferrer">
            N2NS Lab
          </a>{' '}
          ·{' '}
          <a href="https://datafrog.io/widemark" target="_blank" rel="noopener noreferrer">
            datafrog.io
          </a>
        </p>
      </div>
    </div>
  );
}
