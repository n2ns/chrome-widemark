import { afterEach, describe, expect, it, vi } from 'vitest';
import { getUiLocale, initializeI18nDocument, t, tp } from './i18n.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.lang = '';
  document.documentElement.dir = '';
});

describe('i18n', () => {
  it('uses deterministic English fallbacks outside the extension runtime', () => {
    vi.stubGlobal('chrome', undefined);

    expect(t('common_help')).toBe('Help');
    expect(t('actions_delete_bookmark_message', 'Project Docs')).toBe('Delete “Project Docs”?');
    expect(getUiLocale()).toBe('en');
  });

  it('reads localized messages and the UI language from chrome.i18n', () => {
    vi.stubGlobal('chrome', {
      i18n: {
        getUILanguage: vi.fn(() => 'es-ES'),
        getMessage: vi.fn((key: string) => key === 'common_help' ? 'Ayuda' : ''),
      },
    });

    expect(t('common_help')).toBe('Ayuda');
    expect(getUiLocale()).toBe('es-ES');
    expect(t('common_save')).toBe('Save');
  });

  it('selects plural messages and formats substitution values for the locale', () => {
    vi.stubGlobal('chrome', {
      i18n: {
        getUILanguage: vi.fn(() => 'de-DE'),
        getMessage: vi.fn((key: string, substitutions?: string | string[]) => {
          const values = Array.isArray(substitutions) ? substitutions : [substitutions];
          return `${key}:${values.filter(Boolean).join(',')}`;
        }),
      },
    });

    expect(tp('tree_result_count_one', 'tree_result_count_other', 1)).toBe('tree_result_count_one:1');
    expect(tp('tree_result_count_one', 'tree_result_count_other', 1200)).toBe('tree_result_count_other:1.200');
  });

  it('sets the document language and direction from Chrome', () => {
    vi.stubGlobal('chrome', {
      i18n: {
        getUILanguage: vi.fn(() => 'zh-CN'),
        getMessage: vi.fn((key: string) => key === '@@bidi_dir' ? 'ltr' : ''),
      },
    });

    initializeI18nDocument();

    expect(document.documentElement.lang).toBe('zh-CN');
    expect(document.documentElement.dir).toBe('ltr');
  });
});
