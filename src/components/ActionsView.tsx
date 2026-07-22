import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useModalStore } from '../stores/modal.ts';
import { useBookmarksStore } from '../stores/bookmarks.ts';
import { useSettingsStore } from '../stores/settings.ts';
import { useOperationsStore } from '../stores/operations.ts';
import {
  bookmarkUrlKey,
  bookmarkDomainKey,
  addBookmarksToKeyMap,
  collectDuplicateGroups,
  findEmptyFolders,
  findSameNameFolderGroups,
} from '../lib/bookmark-utils.ts';
import { gatherAllBookmarks, runChunkedDuplicateScan, type DuplicateBookmark, type DuplicateScanHandle } from '../lib/duplicate-scan.ts';
import { removeFoldersSequentially, runMergePasses } from '../lib/cleanup.ts';
import { handleBookmarkClick } from '../lib/bookmark-click.ts';
import { formatNumber, t, tp } from '../lib/i18n.ts';
import { withGlobalBookmarkMutation, withGlobalBookmarkRead } from '../lib/bookmark-mutation-lock.ts';
import type { DuplicateGroup } from '../types.ts';
import type { MessageKey } from '../lib/message-catalog.ts';

const CHECK_MODES = {
  url: { keyFn: bookmarkUrlKey, sectionKey: 'actions_duplicate_urls', progressKey: 'actions_checking_urls' },
  domain: { keyFn: bookmarkDomainKey, sectionKey: 'actions_same_domain', progressKey: 'actions_checking_domains' },
} satisfies Record<'url' | 'domain', { keyFn: (url: string) => string | null; sectionKey: MessageKey; progressKey: MessageKey }>;

export function ActionsView() {
  const [progress, setProgress] = useState<{ pct: number; text: string } | null>(null);
  const [results, setResults] = useState<DuplicateGroup<DuplicateBookmark>[] | null>(null);
  const [sectionLabel, setSectionLabel] = useState('');
  const [statusText, setStatusText] = useState('');
  const cleanupStatus = useOperationsStore((s) => s.cleanupStatus);
  const busy = useOperationsStore((s) => s.bookmarkMutationBusy);
  const scanId = useRef(0);
  const scanHandle = useRef<DuplicateScanHandle | null>(null);
  const mounted = useRef(false);
  const lastMode = useRef<'url' | 'domain'>('url');
  const leftClickAction = useSettingsStore((s) => s.leftClickAction);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      scanId.current += 1;
      scanHandle.current?.cancel();
    };
  }, []);

  const batchDeps = {
    beginBatch: useBookmarksStore.getState().beginBatch,
    endBatch: useBookmarksStore.getState().endBatch,
  };

  const startCheck = (mode: 'url' | 'domain') => {
    if (!mounted.current) return;
    if (useOperationsStore.getState().bookmarkMutationBusy) return;
    scanHandle.current?.cancel();
    lastMode.current = mode;
    const checkMode = CHECK_MODES[mode];
    const id = ++scanId.current;
    setProgress({ pct: 0, text: t('actions_checking') });
    setResults(null);
    setStatusText('');

    void withGlobalBookmarkRead(() => new Promise<void>((resolve) => {
      chrome.bookmarks.getTree((tree) => {
        if (id !== scanId.current) {
          resolve();
          return;
        }
        if (chrome.runtime.lastError) {
          setProgress(null);
          setStatusText(t('actions_unable_load'));
          resolve();
          return;
        }
        const all = gatherAllBookmarks(tree, [], [], t('common_bookmarks'));
        if (all.length === 0) {
          setProgress(null);
          setStatusText(t('actions_nothing_to_check'));
          resolve();
          return;
        }
        scanHandle.current = runChunkedDuplicateScan({
          bookmarks: all,
          keyFn: checkMode.keyFn,
          addBookmarksToKeyMap,
          collectDuplicateGroups,
          shouldContinue: () => id === scanId.current,
          onCancel: resolve,
          onProgress: (checked, total) => {
            if (id !== scanId.current) return;
            setProgress({
              pct: Math.round((checked / total) * 100),
              text: t(checkMode.progressKey, [formatNumber(checked), formatNumber(total)]),
            });
          },
          onDone: (dups) => {
            if (id === scanId.current) {
              scanHandle.current = null;
              setResults(dups);
              setSectionLabel(t(checkMode.sectionKey));
              setProgress(null);
              setStatusText(tp('actions_check_complete_one', 'actions_check_complete_other', all.length));
            }
            resolve();
          },
        });
      });
    })).catch(() => {
      if (id === scanId.current && mounted.current) {
        setProgress(null);
        setStatusText(t('actions_unable_load'));
      }
    });
  };

  const deleteDuplicate = async (item: DuplicateBookmark) => {
    if (item.unmodifiable) return;
    if (useOperationsStore.getState().bookmarkMutationBusy) return;
    const ok = await useModalStore.getState().showConfirmDialog({
      title: t('actions_delete_bookmark'),
      message: t('actions_delete_bookmark_message', item.title),
      confirmLabel: t('common_delete'),
    });
    if (!ok) return;
    const operations = useOperationsStore.getState();
    if (!operations.tryBeginMutation()) return;
    let removed = false;
    try {
      removed = await withGlobalBookmarkMutation(() => new Promise<boolean>((resolve) => {
        chrome.bookmarks.remove(item.id, () => resolve(!chrome.runtime.lastError));
      }));
    } finally {
      operations.finishMutation();
    }
    if (!mounted.current) return;
    if (removed) startCheck(lastMode.current);
    else setStatusText(t('common_error'));
  };

  const cleanEmpty = () => {
    const operations = useOperationsStore.getState();
    if (!operations.tryBeginCleanup()) return;
    scanId.current += 1;
    scanHandle.current?.cancel();
    scanHandle.current = null;
    setProgress(null);
    setResults(null);
    chrome.bookmarks.getTree(async (tree) => {
      if (chrome.runtime.lastError) {
        operations.finishCleanup(t('actions_unable_load'));
        return;
      }
      const empties = findEmptyFolders(tree);
      if (empties.length === 0) {
        operations.finishCleanup(t('actions_no_empty_folders'));
        return;
      }
      const preview = empties.slice(0, 6).map((f) => f.path.join(' / ')).join(', ');
      const suffix = empties.length > 6 ? ', …' : '';
      const ok = await useModalStore.getState().showConfirmDialog({
        title: t('actions_delete_empty_folders'),
        message: tp('actions_delete_empty_one', 'actions_delete_empty_other', empties.length, [`${preview}${suffix}`]),
        confirmLabel: t('common_delete'),
      });
      if (!ok) {
        operations.finishCleanup('');
        return;
      }
      chrome.bookmarks.getTree((fresh) => {
        if (chrome.runtime.lastError) {
          operations.finishCleanup(t('actions_unable_load'));
          return;
        }
        const confirmedIds = new Set(empties.map((f) => f.id));
        const freshIds = findEmptyFolders(fresh).filter((f) => confirmedIds.has(f.id)).map((f) => f.id);
        void withGlobalBookmarkMutation(() => new Promise<number>((resolve) => {
          removeFoldersSequentially(freshIds, batchDeps, resolve);
        })).then((removed) => {
          operations.finishCleanup(tp('actions_removed_empty_one', 'actions_removed_empty_other', removed));
        }, () => operations.finishCleanup(t('common_error')));
      });
    });
  };

  const mergeFolders = () => {
    const operations = useOperationsStore.getState();
    if (!operations.tryBeginCleanup()) return;
    scanId.current += 1;
    scanHandle.current?.cancel();
    scanHandle.current = null;
    setProgress(null);
    setResults(null);
    chrome.bookmarks.getTree(async (tree) => {
      if (chrome.runtime.lastError) {
        operations.finishCleanup(t('actions_unable_load'));
        return;
      }
      const groups = findSameNameFolderGroups(tree);
      if (groups.length === 0) {
        operations.finishCleanup(t('actions_no_same_named'));
        return;
      }
      const preview = groups.slice(0, 6).map((g) => g.path.join(' / ')).join(', ');
      const suffix = groups.length > 6 ? ', …' : '';
      const ok = await useModalStore.getState().showConfirmDialog({
        title: t('actions_merge_same_named'),
        message: tp('actions_merge_groups_one', 'actions_merge_groups_other', groups.length, [`${preview}${suffix}`]),
        confirmLabel: t('common_merge'),
      });
      if (!ok) {
        operations.finishCleanup('');
        return;
      }
      void withGlobalBookmarkMutation(() => new Promise<number>((resolve) => {
        runMergePasses(batchDeps, resolve);
      })).then((merged) => {
        operations.finishCleanup(tp('actions_merged_folders_one', 'actions_merged_folders_other', merged));
      }, () => operations.finishCleanup(t('common_error')));
    });
  };

  const openItem = (url: string, event: MouseEvent) => handleBookmarkClick(url, event, leftClickAction);
  const scanning = progress !== null;

  return (
    <div id="actions-view">
      <div className="settings-card">
        <div className="actions-header-row">
          <h3>{t('common_actions')}</h3>
          <div className="actions-buttons-row">
            <button className="modal-btn primary" disabled={scanning || busy} onClick={() => startCheck('url')}>
              {t('actions_duplicate_urls')}
            </button>
            <button className="modal-btn secondary" disabled={scanning || busy} onClick={() => startCheck('domain')}>
              {t('actions_same_domain')}
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
                          {!item.unmodifiable && (
                            <button className="duplicate-btn-delete" disabled={busy} title={t('common_delete')} onClick={() => deleteDuplicate(item)}>
                              ×
                            </button>
                          )}
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
              <div className="no-duplicates-title">{t('actions_no_duplicates')}</div>
              <div className="no-duplicates-note">{t('actions_local_only_note')}</div>
            </div>
          )}
          {statusText && <div className="duplicate-empty-message">{statusText}</div>}
        </div>
      </div>

      <div className="settings-card">
        <div className="actions-header-row">
          <h3>{t('actions_cleanup')}</h3>
          <div className="actions-buttons-row">
            <button className="modal-btn secondary" disabled={busy} onClick={cleanEmpty}>
              {t('actions_empty_folders')}
            </button>
            <button className="modal-btn secondary" disabled={busy} onClick={mergeFolders}>
              {t('actions_merge_folders')}
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
