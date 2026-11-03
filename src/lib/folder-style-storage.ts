import { normalizeFolderStyleRecords, replaceFolderStyle } from './bookmark-utils.ts';
import type { FolderIdentity, FolderStyle, FolderStyleRecord } from '../types.ts';

const FOLDER_STYLES_KEY = 'folderStyles';
const FOLDER_STYLE_CHUNK_PREFIX = `${FOLDER_STYLES_KEY}:`;
const SYNC_ITEM_BYTES = 8192;

interface FolderStyleIndex {
  version: 2;
  revision: string;
  chunkCount: number;
}

interface FolderStyleChunk {
  revision: string;
  records: FolderStyleRecord[];
}

export function isFolderStyleStorageKey(key: string): boolean {
  return key === FOLDER_STYLES_KEY || key.startsWith(FOLDER_STYLE_CHUNK_PREFIX);
}

function storageError(action: string): Error | null {
  return chrome.runtime.lastError
    ? new Error(`${action}: ${chrome.runtime.lastError.message ?? 'Chrome storage error'}`)
    : null;
}

function readFolderStyleStorage(): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(undefined, (values) => {
      const error = storageError('Read folder styles');
      if (error) reject(error);
      else resolve(values);
    });
  });
}

function recordsFromStorage(values: Record<string, unknown>): FolderStyleRecord[] {
  const index = values[FOLDER_STYLES_KEY];
  if (index === undefined && Object.keys(values).some((key) => key.startsWith(FOLDER_STYLE_CHUNK_PREFIX))) {
    throw new Error('Incomplete folder style snapshot');
  }
  if (!index || Array.isArray(index)) return normalizeFolderStyleRecords(index);
  const { version, revision, chunkCount } = index as Partial<FolderStyleIndex>;
  if (version !== 2 || typeof revision !== 'string' || !Number.isInteger(chunkCount) || chunkCount! < 0) {
    throw new Error('Invalid folder style index');
  }
  const records: FolderStyleRecord[] = [];
  for (let i = 0; i < chunkCount!; i += 1) {
    const chunk = values[`${FOLDER_STYLE_CHUNK_PREFIX}${i}`] as Partial<FolderStyleChunk> | undefined;
    if (!chunk || chunk.revision !== revision || !Array.isArray(chunk.records)) {
      throw new Error('Incomplete folder style snapshot');
    }
    records.push(...chunk.records);
  }
  return records;
}

export async function loadFolderStyleRecords(): Promise<FolderStyleRecord[]> {
  return recordsFromStorage(await readFolderStyleStorage());
}

function chunkFolderStyles(records: FolderStyleRecord[]): Record<string, unknown> {
  const revision = crypto.randomUUID();
  const values: Record<string, unknown> = {};
  const encoder = new TextEncoder();
  let chunk: FolderStyleChunk = { revision, records: [] };
  let chunkCount = 0;
  for (const record of records) {
    let key = `${FOLDER_STYLE_CHUNK_PREFIX}${chunkCount}`;
    const next = { revision, records: [...chunk.records, record] };
    if (encoder.encode(key + JSON.stringify(next)).length > SYNC_ITEM_BYTES) {
      if (chunk.records.length > 0) {
        values[key] = chunk;
        chunkCount += 1;
      }
      key = `${FOLDER_STYLE_CHUNK_PREFIX}${chunkCount}`;
      chunk = { revision, records: [record] };
      if (encoder.encode(key + JSON.stringify(chunk)).length > SYNC_ITEM_BYTES) {
        throw new Error('Folder style exceeds the Chrome Sync item quota');
      }
    } else {
      chunk = next;
    }
  }
  if (chunk.records.length > 0) {
    values[`${FOLDER_STYLE_CHUNK_PREFIX}${chunkCount}`] = chunk;
    chunkCount += 1;
  }
  values[FOLDER_STYLES_KEY] = { version: 2, revision, chunkCount } satisfies FolderStyleIndex;
  return values;
}

export async function saveFolderStyleRecord(
  existing: FolderStyleRecord | null | undefined,
  identity: FolderIdentity,
  style: FolderStyle
): Promise<FolderStyleRecord | null> {
  const stored = await readFolderStyleStorage();
  const current = recordsFromStorage(stored);
  const next = replaceFolderStyle(current, existing, identity, style);
  const updates = chunkFolderStyles(next);

  await new Promise<void>((resolve, reject) => {
    // Publish the index and its chunks together; a failed write leaves the
    // previous snapshot (including the legacy array) untouched.
    chrome.storage.sync.set(updates, () => {
      const error = storageError('Save folder styles');
      if (error) reject(error);
      else resolve();
    });
  });

  const obsoleteKeys = Object.keys(stored).filter((key) =>
    key.startsWith(FOLDER_STYLE_CHUNK_PREFIX) && !(key in updates)
  );
  if (obsoleteKeys.length > 0) {
    await new Promise<void>((resolve) => {
      chrome.storage.sync.remove(obsoleteKeys, () => {
        // The committed index ignores these chunks, so cleanup failure must
        // not turn an already successful style edit into a reported failure.
        void chrome.runtime.lastError;
        resolve();
      });
    });
  }

  return next.find((record) =>
    record.dateAdded === identity.dateAdded
    && record.title === identity.title
    && JSON.stringify(record.path ?? []) === JSON.stringify(identity.path ?? [])
  ) ?? null;
}

export async function clearFolderStyleRecords(): Promise<void> {
  const stored = await readFolderStyleStorage();
  const keys = Object.keys(stored).filter(isFolderStyleStorageKey);
  if (keys.length === 0) return;
  return new Promise((resolve, reject) => {
    chrome.storage.sync.remove(keys, () => {
      const error = storageError('Remove folder styles');
      if (error) reject(error);
      else resolve();
    });
  });
}
