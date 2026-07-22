import { FALLBACK_MESSAGES, type MessageKey } from './message-catalog.ts';

type Substitutions = string | string[];

function normalizeSubstitutions(substitutions?: Substitutions): string[] {
  if (substitutions === undefined) return [];
  return Array.isArray(substitutions) ? substitutions : [substitutions];
}

function fallbackMessage(key: MessageKey, substitutions?: Substitutions): string {
  const values = normalizeSubstitutions(substitutions);
  return FALLBACK_MESSAGES[key].replace(/\$(\d+)/g, (_match, index: string) => values[Number(index) - 1] ?? '');
}

export function t(key: MessageKey, substitutions?: Substitutions): string {
  if (typeof chrome !== 'undefined' && typeof chrome.i18n?.getMessage === 'function') {
    const localized = chrome.i18n.getMessage(key, substitutions);
    if (localized) return localized;
  }
  return fallbackMessage(key, substitutions);
}

export function getUiLocale(): string {
  if (typeof chrome !== 'undefined' && typeof chrome.i18n?.getUILanguage === 'function') {
    return chrome.i18n.getUILanguage() || 'en';
  }
  return 'en';
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(getUiLocale()).format(value);
}

export function tp(oneKey: MessageKey, otherKey: MessageKey, count: number, extra: string[] = []): string {
  const category = new Intl.PluralRules(getUiLocale()).select(count);
  return t(category === 'one' ? oneKey : otherKey, [formatNumber(count), ...extra]);
}

export function initializeI18nDocument(): void {
  const root = document.documentElement;
  root.lang = getUiLocale();
  const direction = typeof chrome !== 'undefined' && typeof chrome.i18n?.getMessage === 'function'
    ? chrome.i18n.getMessage('@@bidi_dir')
    : '';
  root.dir = direction === 'rtl' ? 'rtl' : 'ltr';
}
