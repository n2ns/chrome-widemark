import { useRef, useState, type MouseEvent } from 'react';
import { useModalStore } from '../stores/modal.ts';
import { useBookmarksStore } from '../stores/bookmarks.ts';
import { useSettingsStore } from '../stores/settings.ts';
import {
  bookmarkUrlKey,
  bookmarkDomainKey,
  addBookmarksToKeyMap,
  collectDuplicateGroups,
  findEmptyFolders,
  findSameNameFolderGroups,
} from '../lib/bookmark-utils.ts';
import { gatherAllBookmarks, runChunkedDuplicateScan, type DuplicateBookmark } from '../lib/duplicate-scan.ts';
import { removeFoldersSequentially, runMergePasses } from '../lib/cleanup.ts';
import { handleBookmarkClick } from '../lib/bookmark-click.ts';
import type { DuplicateGroup } from '../types.ts';

const CHECK_MODES = {
  url: { keyFn: bookmarkUrlKey, sectionLabel: 'Duplicate URLs', progressLabel: 'duplicate URLs' },
  domain: { keyFn: bookmarkDomainKey, sectionLabel: 'Same Domain', progressLabel: 'same-domain bookmarks' },
};

export function ActionsView() {
  const [progress, setProgress] = useState<{ pct: number; text: string } | null>(null);
  const [results, setResults] = useState<DuplicateGroup<DuplicateBookmark>[] | null>(null);
  const [sectionLabel, setSectionLabel] = useState('');
  const [statusText, setStatusText] = useState('');
  const [cleanupStatus, setCleanupStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const scanId = useRef(0);
  const lastMode = useRef<'url' | 'domain'>('url');
  const leftClickAction = useSettingsStore((s) => s.leftClickAction);

  const batchDeps = {
    beginBatch: useBookmarksStore.getState().beginBatch,
    endBatch: useBookmarksStore.getState().endBatch,
  };

  const startCheck = (mode: 'url' | 'domain') => {
    lastMode.current = mode;
    const checkMode = CHECK_MODES[mode];
    const id = ++scanId.current;
    setProgress({ pct: 0, text: 'Checking...' });
    setResults(null);
    setStatusText('');

    chrome.bookmarks.getTree((tree) => {
      if (id !== scanId.current) return;
      if (chrome.runtime.lastError) {
        setProgress(null);
        setStatusText('Unable to load bookmarks.');
        return;
      }
      const all = gatherAllBookmarks(tree);
      if (all.length === 0) {
        setProgress({ pct: 0, text: 'No bookmarks to check.' });
        return;
      }
      runChunkedDuplicateScan({
        bookmarks: all,
        keyFn: checkMode.keyFn,
        addBookmarksToKeyMap,
        collectDuplicateGroups,
        shouldContinue: () => id === scanId.current,
        onProgress: (checked, total) => {
          if (id !== scanId.current) return;
          setProgress({ pct: Math.round((checked / total) * 100), text: `Checking ${checkMode.progressLabel} (${checked}/${total})...` });
        },
        onDone: (dups) => {
          if (id !== scanId.current) return;
          setResults(dups);
          setSectionLabel(checkMode.sectionLabel);
          setProgress(null);
          setStatusText(`Duplicate check complete. Checked ${all.length} bookmark(s).`);
        },
      });
    });
  };

  const deleteDuplicate = async (id: string, title: string) => {
    const ok = await useModalStore.getState().showConfirmDialog({ title: 'Delete Bookmark', message: `Delete "${title}"?`, confirmLabel: 'Delete' });
    if (!ok) return;
    chrome.bookmarks.remove(id, () => startCheck(lastMode.current));
  };

  const cleanEmpty = () => {
    chrome.bookmarks.getTree(async (tree) => {
      if (chrome.runtime.lastError) {
        setCleanupStatus('Unable to load bookmarks.');
        return;
      }
      const empties = findEmptyFolders(tree);
      if (empties.length === 0) {
        setCleanupStatus('No empty folders found.');
        return;
      }
      const preview = empties.slice(0, 6).map((f) => f.path.join(' / ')).join(', ');
      const suffix = empties.length > 6 ? ', …' : '';
      const ok = await useModalStore.getState().showConfirmDialog({
        title: 'Delete Empty Folders',
        message: `Delete ${empties.length} empty folder(s)? (${preview}${suffix})`,
        confirmLabel: 'Delete',
      });
      if (!ok) return;
      setBusy(true);
      chrome.bookmarks.getTree((fresh) => {
        if (chrome.runtime.lastError) {
          setBusy(false);
          setCleanupStatus('Unable to load bookmarks.');
          return;
        }
        const confirmedIds = new Set(empties.map((f) => f.id));
        const freshIds = findEmptyFolders(fresh).filter((f) => confirmedIds.has(f.id)).map((f) => f.id);
        removeFoldersSequentially(freshIds, batchDeps, (removed) => {
          setBusy(false);
          setCleanupStatus(`Removed ${removed} empty folder(s).`);
        });
      });
    });
  };

  const mergeFolders = () => {
    chrome.bookmarks.getTree(async (tree) => {
      if (chrome.runtime.lastError) {
        setCleanupStatus('Unable to load bookmarks.');
        return;
      }
      const groups = findSameNameFolderGroups(tree);
      if (groups.length === 0) {
        setCleanupStatus('No same-named sibling folders found.');
        return;
      }
      const preview = groups.slice(0, 6).map((g) => g.path.join(' / ')).join(', ');
      const suffix = groups.length > 6 ? ', …' : '';
      const ok = await useModalStore.getState().showConfirmDialog({
        title: 'Merge Same-Named Folders',
        message: `Merge ${groups.length} group(s) of same-named sibling folders? Contents combine into the first folder of each group. (${preview}${suffix})`,
        confirmLabel: 'Merge',
      });
      if (!ok) return;
      setBusy(true);
      runMergePasses(batchDeps, (merged) => {
        setBusy(false);
        setCleanupStatus(`Merged ${merged} folder(s).`);
      });
    });
  };

  const openItem = (url: string, event: MouseEvent) => handleBookmarkClick(url, event, leftClickAction);
  const scanning = progress !== null;

  return (
    <div id="actions-view">
      <div className="settings-card">
        <div className="actions-header-row">
          <h3>Actions</h3>
          <div className="actions-buttons-row">
            <button className="modal-btn primary" disabled={scanning} onClick={() => startCheck('url')}>
              Duplicate URLs
            </button>
            <button className="modal-btn secondary" disabled={scanning} onClick={() => startCheck('domain')}>
              Same Domain
            </button>
          </div>
        </div>

        {progress && (
          <div className="duplicate-progress-container">
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${progress.pct}%` }} />
            </div>
            <div className="progress-text-row">
              <span>{progress.text}</span>
            </div>
          </div>
        )}

        <div className="duplicate-results-container">
          {results && results.length > 0 && (
            <div className="duplicate-section">
              <div className="duplicate-section-header">{sectionLabel}</div>
              <div className="duplicate-list">
                {results.map((group, gi) => (
                  <div className="duplicate-group" key={`${group.url}-${gi}`}>
                    <div className="duplicate-group-header">{group.url}</div>
                    <div className="duplicate-group-items">
                      {group.items.map((item) => (
                        <div className="duplicate-item" key={item.id}>
                          <div className="duplicate-item-content" onClick={(e) => openItem(item.url, e)}>
                            <span className="duplicate-item-title">{item.title}</span>
                            <span className="duplicate-item-url">{item.url}</span>
                            <span className="duplicate-item-path">{item.folderPath}</span>
                          </div>
                          <button className="duplicate-btn-delete" title="Delete" onClick={() => deleteDuplicate(item.id, item.title)}>
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {results && results.length === 0 && (
            <div className="no-duplicates-state">
              <div className="no-duplicates-title">No duplicate bookmarks found.</div>
              <div className="no-duplicates-note">This duplicate check only checks local bookmark URLs and does not contact websites.</div>
            </div>
          )}
          {statusText && <div className="duplicate-empty-message">{statusText}</div>}
        </div>
      </div>

      <div className="settings-card">
        <div className="actions-header-row">
          <h3>Cleanup</h3>
          <div className="actions-buttons-row">
            <button className="modal-btn secondary" disabled={busy} onClick={cleanEmpty}>
              Empty Folders
            </button>
            <button className="modal-btn secondary" disabled={busy} onClick={mergeFolders}>
              Merge Folders
            </button>
          </div>
        </div>
        <div className="duplicate-results-container">
          {cleanupStatus && <div className="duplicate-empty-message">{cleanupStatus}</div>}
        </div>
      </div>
    </div>
  );
}
