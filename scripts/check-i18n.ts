import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FALLBACK_MESSAGES, MESSAGE_KEYS } from '../src/lib/message-catalog.ts';

const LOCALES = ['en', 'es', 'de', 'fr', 'zh_CN', 'zh_TW', 'ja', 'ko', 'tr', 'vi'] as const;
const LOCALES_ROOT = join(process.cwd(), 'public', '_locales');
const discoveredLocales = readdirSync(LOCALES_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

interface ChromeMessage {
  message: string;
  placeholders?: Record<string, { content: string; example?: string }>;
}

type ChromeMessages = Record<string, ChromeMessage>;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort();
}

function assertSame(label: string, actual: string[], expected: string[]): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const missing = expected.filter((value) => !actual.includes(value));
    const extra = actual.filter((value) => !expected.includes(value));
    throw new Error(`${label}: missing [${missing.join(', ')}], extra [${extra.join(', ')}]`);
  }
}

const catalogs = new Map<string, ChromeMessages>();
assertSame('Locale directories', discoveredLocales, [...LOCALES].sort());
for (const locale of LOCALES) {
  const path = join(LOCALES_ROOT, locale, 'messages.json');
  const messages = readJson<ChromeMessages>(path);
  for (const [key, entry] of Object.entries(messages)) {
    if (!entry || typeof entry.message !== 'string' || entry.message.trim() === '') {
      throw new Error(`${locale}.${key} must contain a non-empty message`);
    }
  }
  catalogs.set(locale, messages);

  const manifestLimits = { manifest_name: 75, manifest_short_name: 12, manifest_description: 132 } as const;
  for (const [key, limit] of Object.entries(manifestLimits)) {
    const length = [...(messages[key]?.message ?? '')].length;
    if (length > limit) throw new Error(`${locale}.${key} has ${length} characters; Chrome allows at most ${limit}`);
  }
}

const expectedKeys = sorted(MESSAGE_KEYS);
const english = catalogs.get('en')!;
assertSame('English catalog keys vs typed message keys', sorted(Object.keys(english)), expectedKeys);

for (const locale of LOCALES) {
  const messages = catalogs.get(locale)!;
  assertSame(`${locale} catalog keys`, sorted(Object.keys(messages)), expectedKeys);
  for (const key of expectedKeys) {
    const tokens = sorted([...messages[key]!.message.matchAll(/\$([A-Za-z0-9_]+)\$/g)].map((match) => match[1]!.toLowerCase()));
    const expectedPlaceholders = sorted(Object.keys(english[key]?.placeholders ?? {}));
    const actualPlaceholders = sorted(Object.keys(messages[key]?.placeholders ?? {}));
    assertSame(`${locale}.${key} placeholders`, actualPlaceholders, expectedPlaceholders);
    assertSame(`${locale}.${key} placeholder tokens`, tokens, actualPlaceholders);
    for (const placeholder of actualPlaceholders) {
      const expectedContent = english[key]!.placeholders![placeholder]!.content;
      const actualContent = messages[key]!.placeholders![placeholder]!.content;
      if (actualContent !== expectedContent) {
        throw new Error(`${locale}.${key}.${placeholder} must use content ${expectedContent}, received ${actualContent}`);
      }
    }
  }
}

for (const key of expectedKeys) {
  const entry = english[key]!;
  const normalized = entry.message.replace(/\$([A-Za-z0-9_]+)\$/g, (_token, name: string) => entry.placeholders?.[name.toLowerCase()]?.content ?? '');
  if (normalized !== FALLBACK_MESSAGES[key as keyof typeof FALLBACK_MESSAGES]) {
    throw new Error(`English catalog and fallback differ for ${key}`);
  }
}

const manifest = readJson<unknown>(join(process.cwd(), 'manifest.json'));
const manifestMessages = new Set<string>();
function collectManifestMessages(value: unknown): void {
  if (typeof value === 'string') {
    const match = /^__MSG_([A-Za-z0-9_]+)__$/.exec(value);
    if (match) manifestMessages.add(match[1]!);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(collectManifestMessages);
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach(collectManifestMessages);
  }
}
collectManifestMessages(manifest);
for (const key of manifestMessages) {
  if (!english[key]) throw new Error(`Manifest references missing message key: ${key}`);
}

console.log(`Validated ${expectedKeys.length} messages across ${LOCALES.length} locales and ${manifestMessages.size} manifest references.`);
