import { findSameNameFolderGroups } from './bookmark-utils.ts';
import type { SameNameFolderGroup } from '../types.ts';

const MAX_MERGE_PASSES = 10;

export interface BatchDeps {
  beginBatch: () => void;
  endBatch: () => void;
}

// Delete each folder only if it is still empty at the exact mutation point.
// chrome.bookmarks.remove is atomic here: unlike removeTree, it fails instead
// of deleting children that appeared after the confirmation/revalidation.
export function removeFoldersSequentially(ids: string[], deps: BatchDeps, onDone: (removed: number) => void) {
  deps.beginBatch();
  let index = 0;
  let removed = 0;
  const next = () => {
    if (index >= ids.length) {
      deps.endBatch();
      onDone(removed);
      return;
    }
    chrome.bookmarks.remove(ids[index]!, () => {
      if (!chrome.runtime.lastError) removed += 1;
      index += 1;
      next();
    });
  };
  next();
}

function mergeGroups(groups: SameNameFolderGroup[], deps: BatchDeps, onGroupsDone: (merged: number) => void) {
  deps.beginBatch();
  let groupIndex = 0;
  let mergedCount = 0;

  const nextGroup = () => {
    if (groupIndex >= groups.length) {
      deps.endBatch();
      onGroupsDone(mergedCount);
      return;
    }
    const group = groups[groupIndex]!;
    let mergeIndex = 0;

    const nextSource = () => {
      if (mergeIndex >= group.mergeIds.length) {
        groupIndex += 1;
        nextGroup();
        return;
      }
      const sourceId = group.mergeIds[mergeIndex]!;
      chrome.bookmarks.getChildren(sourceId, (children) => {
        if (chrome.runtime.lastError) {
          // May have been removed by an earlier merge this pass; skip it.
          mergeIndex += 1;
          nextSource();
          return;
        }
        const items = children || [];
        let itemIndex = 0;
        let anyMoveFailed = false;
        const moveNext = () => {
          if (itemIndex >= items.length) {
            // Never delete the source unless every child actually left it.
            if (anyMoveFailed) {
              mergeIndex += 1;
              nextSource();
              return;
            }
            chrome.bookmarks.remove(sourceId, () => {
              if (!chrome.runtime.lastError) mergedCount += 1;
              mergeIndex += 1;
              nextSource();
            });
            return;
          }
          chrome.bookmarks.move(items[itemIndex]!.id, { parentId: group.keepId }, () => {
            if (chrome.runtime.lastError) anyMoveFailed = true;
            itemIndex += 1;
            moveNext();
          });
        };
        moveNext();
      });
    };
    nextSource();
  };
  nextGroup();
}

// Re-scan and merge until nothing changes (a merge can reveal new same-named
// siblings a level up) or the pass cap is hit.
export function runMergePasses(deps: BatchDeps, onDone: (merged: number) => void) {
  const pass = (n: number, mergedSoFar: number) => {
    chrome.bookmarks.getTree((tree) => {
      if (chrome.runtime.lastError) {
        onDone(mergedSoFar);
        return;
      }
      const groups = findSameNameFolderGroups(tree);
      if (groups.length === 0 || n >= MAX_MERGE_PASSES) {
        onDone(mergedSoFar);
        return;
      }
      mergeGroups(groups, deps, (mergedThisPass) => {
        if (mergedThisPass === 0) {
          onDone(mergedSoFar);
          return;
        }
        pass(n + 1, mergedSoFar + mergedThisPass);
      });
    });
  };
  pass(0, 0);
}
