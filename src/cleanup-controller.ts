  import type {
    SameNameFolderGroup,
    ReportChromeError
  } from './types.ts';

  interface CleanupControllerDeps {
    document: Document;
    chromeApi: typeof chrome;
    bookmarkUtils: typeof import('./bookmark-utils.ts');
    modalDialog: {
      showConfirmDialog: (options: {
        title: string;
        message: string;
        confirmLabel?: string;
        cancelLabel?: string;
      }) => Promise<boolean>;
    };
    reportChromeError: ReportChromeError;
    beginBatchUpdates: () => void;
    endBatchUpdates: () => void;
  }

  const MAX_MERGE_PASSES = 10;

  function createCleanupController({
    document,
    chromeApi,
    bookmarkUtils,
    modalDialog,
    reportChromeError,
    beginBatchUpdates,
    endBatchUpdates
  }: CleanupControllerDeps) {
    const emptyFoldersBtn = document.getElementById('clean-empty-folders-btn') as HTMLButtonElement;
    const mergeFoldersBtn = document.getElementById('merge-folders-btn') as HTMLButtonElement;
    const cleanupResults = document.getElementById('cleanup-results') as HTMLElement;
    const { showConfirmDialog } = modalDialog;

    function setStatus(message: string) {
      cleanupResults.textContent = '';
      const el = document.createElement('div');
      el.className = 'duplicate-empty-message';
      el.textContent = message;
      cleanupResults.appendChild(el);
    }

    function setButtonsEnabled(enabled: boolean) {
      emptyFoldersBtn.disabled = !enabled;
      mergeFoldersBtn.disabled = !enabled;
    }

    function removeSequentially(ids: string[], onDone: (removedCount: number) => void) {
      beginBatchUpdates();
      let index = 0;
      let removedCount = 0;
      const next = () => {
        if (index >= ids.length) {
          endBatchUpdates();
          onDone(removedCount);
          return;
        }
        chromeApi.bookmarks.removeTree(ids[index]!, () => {
          if (chromeApi.runtime.lastError) {
            reportChromeError('Error removing folder');
          } else {
            removedCount += 1;
          }
          index += 1;
          next();
        });
      };
      next();
    }

    function cleanEmptyFolders() {
      chromeApi.bookmarks.getTree(async (tree) => {
        if (chromeApi.runtime.lastError) {
          reportChromeError('Error loading bookmarks for cleanup');
          setStatus('Unable to load bookmarks.');
          return;
        }

        const empties = bookmarkUtils.findEmptyFolders(tree);
        if (empties.length === 0) {
          setStatus('No empty folders found.');
          return;
        }

        const preview = empties.slice(0, 6).map((folder) => folder.path.join(' / ')).join(', ');
        const suffix = empties.length > 6 ? ', …' : '';
        const confirmed = await showConfirmDialog({
          title: 'Delete Empty Folders',
          message: `Delete ${empties.length} empty folder(s)? (${preview}${suffix})`,
          confirmLabel: 'Delete'
        });
        if (!confirmed) return;

        // Re-scan after the confirmation dialog: a bookmark may have been
        // added to one of these folders while the dialog was open.
        setButtonsEnabled(false);
        chromeApi.bookmarks.getTree((freshTree) => {
          if (chromeApi.runtime.lastError) {
            reportChromeError('Error loading bookmarks for cleanup');
            setButtonsEnabled(true);
            setStatus('Unable to load bookmarks.');
            return;
          }
          // Delete only folders that are still empty AND were shown in the
          // confirmation dialog — never anything the user did not confirm.
          const confirmedIds = new Set(empties.map((folder) => folder.id));
          const freshEmpties = bookmarkUtils.findEmptyFolders(freshTree)
            .filter((folder) => confirmedIds.has(folder.id));
          removeSequentially(freshEmpties.map((folder) => folder.id), (removedCount) => {
            setButtonsEnabled(true);
            setStatus(`Removed ${removedCount} empty folder(s).`);
          });
        });
      });
    }

    // Merge every same-titled sibling folder group into its first folder.
    // Merging can surface new groups (two merged parents may each contribute
    // a child of the same name), so re-scan until nothing is left.
    function mergeGroups(groups: SameNameFolderGroup[], onGroupsDone: (mergedCount: number) => void) {
      beginBatchUpdates();
      let groupIndex = 0;
      let mergedCount = 0;

      const nextGroup = () => {
        if (groupIndex >= groups.length) {
          endBatchUpdates();
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
          chromeApi.bookmarks.getChildren(sourceId, (children) => {
            if (chromeApi.runtime.lastError) {
              // The folder may have been removed by an earlier merge in this
              // pass; a later pass re-scans, so just skip it.
              reportChromeError('Error reading folder for merge');
              mergeIndex += 1;
              nextSource();
              return;
            }
            const items = children || [];
            let itemIndex = 0;
            let anyMoveFailed = false;
            const moveNext = () => {
              if (itemIndex >= items.length) {
                // Never delete a source folder unless every child left it —
                // a failed move would otherwise be destroyed with the folder.
                if (anyMoveFailed) {
                  mergeIndex += 1;
                  nextSource();
                  return;
                }
                // The source should be empty now; plain remove() makes Chrome
                // itself refuse if anything slipped in after our snapshot
                // (e.g. a sync write), leaving it for the next pass.
                chromeApi.bookmarks.remove(sourceId, () => {
                  if (chromeApi.runtime.lastError) {
                    reportChromeError('Error removing merged folder');
                  } else {
                    mergedCount += 1;
                  }
                  mergeIndex += 1;
                  nextSource();
                });
                return;
              }
              chromeApi.bookmarks.move(items[itemIndex]!.id, { parentId: group.keepId }, () => {
                if (chromeApi.runtime.lastError) {
                  reportChromeError('Error merging folder contents');
                  anyMoveFailed = true;
                }
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

    function runMergePasses(pass: number, mergedSoFar: number, onDone: (mergedCount: number) => void) {
      chromeApi.bookmarks.getTree((tree) => {
        if (chromeApi.runtime.lastError) {
          reportChromeError('Error loading bookmarks for merge');
          onDone(mergedSoFar);
          return;
        }
        const groups = bookmarkUtils.findSameNameFolderGroups(tree);
        if (groups.length === 0 || pass >= MAX_MERGE_PASSES) {
          onDone(mergedSoFar);
          return;
        }
        mergeGroups(groups, (mergedThisPass) => {
          // If nothing succeeded this pass, stop instead of spinning on the
          // same unmergeable groups.
          if (mergedThisPass === 0) {
            onDone(mergedSoFar);
            return;
          }
          runMergePasses(pass + 1, mergedSoFar + mergedThisPass, onDone);
        });
      });
    }

    function mergeSameNameFolders() {
      chromeApi.bookmarks.getTree(async (tree) => {
        if (chromeApi.runtime.lastError) {
          reportChromeError('Error loading bookmarks for merge');
          setStatus('Unable to load bookmarks.');
          return;
        }

        const groups = bookmarkUtils.findSameNameFolderGroups(tree);
        if (groups.length === 0) {
          setStatus('No same-named sibling folders found.');
          return;
        }

        const preview = groups.slice(0, 6).map((group) => group.path.join(' / ')).join(', ');
        const suffix = groups.length > 6 ? ', …' : '';
        const confirmed = await showConfirmDialog({
          title: 'Merge Same-Named Folders',
          message: `Merge ${groups.length} group(s) of same-named sibling folders? Contents are combined into the first folder of each group. (${preview}${suffix})`,
          confirmLabel: 'Merge'
        });
        if (!confirmed) return;

        setButtonsEnabled(false);
        runMergePasses(0, 0, (mergedCount) => {
          setButtonsEnabled(true);
          setStatus(`Merged ${mergedCount} folder(s).`);
        });
      });
    }

    emptyFoldersBtn.addEventListener('click', cleanEmptyFolders);
    mergeFoldersBtn.addEventListener('click', mergeSameNameFolders);

    return {
      cleanEmptyFolders,
      mergeSameNameFolders
    };
  }

  export {
    createCleanupController
  };
