import { normalizeFolderStyleRecords, replaceFolderStyle } from './bookmark-utils.ts';
import type { FolderIdentity, FolderStyle, FolderStyleRecord } from '../types.ts';

const FOLDER_STYLES_KEY = 'folderStyles';

function storageError(action: string): Error | null {
  return chrome.runtime.lastError
    ? new Error(`${action}: ${chrome.runtime.lastError.message ?? 'Chrome storage error'}`)
    : null;
}

export function loadFolderStyleRecords(): Promise<FolderStyleRecord[]> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get([FOLDER_STYLES_KEY], (values) => {
      const error = storageError('Read folder styles');
      if (error) reject(error);
      else resolve(normalizeFolderStyleRecords(values[FOLDER_STYLES_KEY]));
    });
  });
}

export async function saveFolderStyleRecord(
  existing: FolderStyleRecord | null | undefined,
  identity: FolderIdentity,
  style: FolderStyle
): Promise<FolderStyleRecord | null> {
  const current = await loadFolderStyleRecords();
  const next = replaceFolderStyle(current, existing, identity, style);

  await new Promise<void>((resolve, reject) => {
    chrome.storage.sync.set({ [FOLDER_STYLES_KEY]: next }, () => {
      const error = storageError('Save folder styles');
      if (error) reject(error);
      else resolve();
    });
  });

  return next.find((record) =>
    record.dateAdded === identity.dateAdded
    && record.title === identity.title
    && JSON.stringify(record.path ?? []) === JSON.stringify(identity.path ?? [])
  ) ?? null;
}

export function clearFolderStyleRecords(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.remove(FOLDER_STYLES_KEY, () => {
      const error = storageError('Remove folder styles');
      if (error) reject(error);
      else resolve();
    });
  });
}
