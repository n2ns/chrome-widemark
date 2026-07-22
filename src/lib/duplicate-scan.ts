// Framework-agnostic duplicate scanning: flatten the bookmark tree (attaching a
// display folder path) and group by key in time-sliced chunks. No DOM.
import type { BookmarkNode, ScannedBookmark, DuplicateGroup } from '../types.ts';

// Runtime shape produced by gatherAllBookmarks: a flattened bookmark whose
// folderPath is the joined display string (not ScannedBookmark's string[]).
export type DuplicateBookmark = Omit<ScannedBookmark, 'folderPath'>
  & Pick<BookmarkNode, 'unmodifiable'>
  & { folderPath: string };

export type KeyFn = (url: string) => string | null;

export interface RunChunkedDuplicateScanOptions {
  bookmarks: DuplicateBookmark[];
  keyFn: KeyFn;
  addBookmarksToKeyMap: (bookmarks: DuplicateBookmark[], keyFn: KeyFn, keyMap: Map<string, DuplicateBookmark[]>) => Map<string, DuplicateBookmark[]>;
  collectDuplicateGroups: (keyMap: Map<string, DuplicateBookmark[]>) => DuplicateGroup<DuplicateBookmark>[];
  onProgress: (checked: number, total: number) => void;
  onDone: (duplicates: DuplicateGroup<DuplicateBookmark>[]) => void;
  onCancel?: () => void;
  shouldContinue?: () => boolean;
}

export interface DuplicateScanHandle {
  cancel: () => void;
}

export function gatherAllBookmarks(
  nodes: BookmarkNode[],
  bookmarksList: DuplicateBookmark[] = [],
  folderPath: string[] = [],
  rootLabel = 'Bookmarks'
) {
  nodes.forEach(node => {
    if (node.url) {
      bookmarksList.push({
        ...node,
        folderPath: folderPath.length > 0 ? folderPath.join(' / ') : rootLabel
      } as DuplicateBookmark);
    } else if (node.children) {
      const nextPath = node.title
        ? [...folderPath, node.title]
        : folderPath;
      gatherAllBookmarks(node.children, bookmarksList, nextPath, rootLabel);
    }
  });
  return bookmarksList;
}

const SCAN_CHUNK_SIZE = 200;

export function runChunkedDuplicateScan({ bookmarks, keyFn, addBookmarksToKeyMap, collectDuplicateGroups, onProgress, onDone, onCancel, shouldContinue }: RunChunkedDuplicateScanOptions): DuplicateScanHandle {
  const keyMap = new Map<string, DuplicateBookmark[]>();
  let index = 0;
  let cancelled = false;
  let cancellationReported = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function step() {
    if (cancelled || (shouldContinue && !shouldContinue())) {
      if (!cancellationReported) {
        cancellationReported = true;
        onCancel?.();
      }
      return;
    }
    const chunk = bookmarks.slice(index, index + SCAN_CHUNK_SIZE);
    addBookmarksToKeyMap(chunk, keyFn, keyMap);
    index += chunk.length;
    onProgress(index, bookmarks.length);
    if (index < bookmarks.length) {
      timer = setTimeout(step, 0);
    } else {
      onDone(collectDuplicateGroups(keyMap));
    }
  }

  step();
  return {
    cancel: () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      if (!cancellationReported) {
        cancellationReported = true;
        onCancel?.();
      }
    },
  };
}
