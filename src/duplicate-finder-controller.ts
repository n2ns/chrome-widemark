import { createDuplicateRenderer } from './duplicate-renderer.ts';
import type { BookmarkNode, ScannedBookmark, DuplicateGroup, ReportChromeError } from './types.ts';

  // Runtime shape produced by gatherAllBookmarks: a flattened bookmark whose
  // folderPath is the joined display string (not ScannedBookmark's string[]).
  type DuplicateBookmark = Omit<ScannedBookmark, 'folderPath'> & { folderPath: string };

  type KeyFn = (url: string) => string | null;

  interface ModalDialog {
    showInfoDialog(options: { title: string; message: string; confirmLabel?: string }): void;
    showConfirmDialog(options: { title: string; message: string; confirmLabel?: string; cancelLabel?: string }): Promise<boolean>;
  }

  interface BookmarkUtils {
    bookmarkUrlKey: KeyFn;
    bookmarkDomainKey: KeyFn;
    addBookmarksToKeyMap: (bookmarks: DuplicateBookmark[], keyFn: KeyFn, keyMap: Map<string, DuplicateBookmark[]>) => Map<string, DuplicateBookmark[]>;
    collectDuplicateGroups: (keyMap: Map<string, DuplicateBookmark[]>) => DuplicateGroup<DuplicateBookmark>[];
  }

  interface CheckMode {
    keyFn: KeyFn;
    sectionLabel: string;
    progressLabel: string;
  }

  interface RunChunkedDuplicateScanOptions {
    bookmarks: DuplicateBookmark[];
    keyFn: KeyFn;
    addBookmarksToKeyMap: (bookmarks: DuplicateBookmark[], keyFn: KeyFn, keyMap: Map<string, DuplicateBookmark[]>) => Map<string, DuplicateBookmark[]>;
    collectDuplicateGroups: (keyMap: Map<string, DuplicateBookmark[]>) => DuplicateGroup<DuplicateBookmark>[];
    onProgress: (checked: number, total: number) => void;
    onDone: (duplicates: DuplicateGroup<DuplicateBookmark>[]) => void;
    shouldContinue?: () => boolean;
  }

  interface DuplicateFinderControllerDeps {
    document: Document;
    chromeApi: typeof chrome;
    bookmarkUtils: BookmarkUtils;
    handleBookmarkClick: (url: string, event: Event) => void;
    modalDialog?: ModalDialog | null;
    reportChromeError: ReportChromeError;
  }

  function gatherAllBookmarks(nodes: BookmarkNode[], bookmarksList: DuplicateBookmark[] = [], folderPath: string[] = []) {
    nodes.forEach(node => {
      if (node.url) {
        bookmarksList.push({
          ...node,
          folderPath: folderPath.length > 0 ? folderPath.join(' / ') : 'Bookmarks'
        } as DuplicateBookmark);
      } else if (node.children) {
        const nextPath = node.title
          ? [...folderPath, node.title]
          : folderPath;
        gatherAllBookmarks(node.children, bookmarksList, nextPath);
      }
    });
    return bookmarksList;
  }

  function renderNoDuplicates(duplicateResults: HTMLElement) {
    duplicateResults.innerHTML = `
      <div class="no-duplicates-state">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        <div class="no-duplicates-title">No duplicate bookmarks found.</div>
        <div class="no-duplicates-note">This duplicate check only checks local bookmark URLs and does not contact websites.</div>
      </div>
    `;
  }

  const SCAN_CHUNK_SIZE = 200;

  function runChunkedDuplicateScan({ bookmarks, keyFn, addBookmarksToKeyMap, collectDuplicateGroups, onProgress, onDone, shouldContinue }: RunChunkedDuplicateScanOptions) {
    const keyMap = new Map<string, DuplicateBookmark[]>();
    let index = 0;

    function step() {
      if (shouldContinue && !shouldContinue()) return;
      const chunk = bookmarks.slice(index, index + SCAN_CHUNK_SIZE);
      addBookmarksToKeyMap(chunk, keyFn, keyMap);
      index += chunk.length;
      onProgress(index, bookmarks.length);
      if (index < bookmarks.length) {
        setTimeout(step, 0);
      } else {
        onDone(collectDuplicateGroups(keyMap));
      }
    }

    step();
  }

  function createDuplicateFinderController({
    document,
    chromeApi,
    bookmarkUtils,
    handleBookmarkClick,
    modalDialog,
    reportChromeError
  }: DuplicateFinderControllerDeps) {
    const urlDuplicatesBtn = document.getElementById('find-duplicates-btn')!;
    const domainDuplicatesBtn = document.getElementById('find-domain-duplicates-btn');
    const duplicateProgressContainer = document.getElementById('duplicate-progress-container')!;
    const duplicateProgressBar = document.getElementById('duplicate-progress-bar')!;
    const duplicateProgressText = document.getElementById('duplicate-progress-text')!;
    const duplicateResults = document.getElementById('duplicate-results')!;

    const CHECK_MODES: Record<string, CheckMode> = {
      url: {
        keyFn: bookmarkUtils.bookmarkUrlKey,
        sectionLabel: 'Duplicate URLs',
        progressLabel: 'duplicate URLs'
      },
      domain: {
        keyFn: bookmarkUtils.bookmarkDomainKey,
        sectionLabel: 'Same Domain',
        progressLabel: 'same-domain bookmarks'
      }
    };

    let lastCheckMode = 'url';
    let activeScanId = 0;

    const { renderDuplicates } = createDuplicateRenderer({
      documentRef: document,
      duplicateResults,
      handleBookmarkClick,
      restartDuplicateCheck: () => startDuplicateCheck(lastCheckMode),
      chromeApi,
      modalDialog
    });

    function setButtonsVisible(visible: boolean) {
      const display = visible ? 'inline-flex' : 'none';
      urlDuplicatesBtn.style.display = display;
      if (domainDuplicatesBtn) domainDuplicatesBtn.style.display = display;
    }

    function resetProgress() {
      setButtonsVisible(false);
      duplicateProgressContainer.style.display = 'block';
      duplicateResults.innerHTML = '';
      duplicateProgressBar.style.width = '0%';
      duplicateProgressText.style.color = '';
      duplicateProgressText.textContent = 'Gathering bookmarks...';
    }

    function showLoadError() {
      duplicateProgressText.textContent = 'Unable to load bookmarks for duplicate check.';
      duplicateProgressText.style.color = '#ef4444';
      setButtonsVisible(true);
      reportChromeError('Error loading bookmarks for duplicate check');
    }

    function startDuplicateCheck(mode: string = 'url') {
      const checkMode = CHECK_MODES[mode] || CHECK_MODES.url!;
      lastCheckMode = CHECK_MODES[mode] ? mode : 'url';
      // A newer scan supersedes any still-running one (e.g. two quick
      // deletions from the results list each restart the scan).
      const scanId = ++activeScanId;
      resetProgress();

      chromeApi.bookmarks.getTree((bookmarkTreeNodes) => {
        if (scanId !== activeScanId) return;
        if (chromeApi.runtime.lastError) {
          showLoadError();
          return;
        }

        const allBookmarks = gatherAllBookmarks(bookmarkTreeNodes);
        const totalCount = allBookmarks.length;

        if (totalCount === 0) {
          duplicateProgressText.textContent = 'No bookmarks to check.';
          setButtonsVisible(true);
          return;
        }

        runChunkedDuplicateScan({
          bookmarks: allBookmarks,
          keyFn: checkMode.keyFn,
          addBookmarksToKeyMap: bookmarkUtils.addBookmarksToKeyMap,
          collectDuplicateGroups: bookmarkUtils.collectDuplicateGroups,
          shouldContinue: () => scanId === activeScanId,
          onProgress: (checked, total) => {
            if (scanId !== activeScanId) return;
            duplicateProgressBar.style.width = `${Math.round((checked / total) * 100)}%`;
            duplicateProgressText.textContent = `Checking ${checkMode.progressLabel} (${checked}/${total})...`;
          },
          onDone: (duplicates) => {
            if (scanId !== activeScanId) return;
            renderDuplicates(duplicates, checkMode.sectionLabel);
            duplicateProgressText.textContent = `Duplicate check complete. Checked ${totalCount} bookmark(s).`;
            if (duplicates.length === 0) {
              renderNoDuplicates(duplicateResults);
            }
            setButtonsVisible(true);
          }
        });
      });
    }

    urlDuplicatesBtn.addEventListener('click', () => startDuplicateCheck('url'));
    if (domainDuplicatesBtn) {
      domainDuplicatesBtn.addEventListener('click', () => startDuplicateCheck('domain'));
    }

    return {
      startDuplicateCheck
    };
  }

  export {
    gatherAllBookmarks,
    runChunkedDuplicateScan,
    createDuplicateFinderController
  };
