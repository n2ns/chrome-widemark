import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useContextMenuStore } from '../stores/contextMenu.ts';
import { useModalStore } from '../stores/modal.ts';
import { useFolderStylesStore } from '../stores/folderStyles.ts';
import { useBookmarksStore } from '../stores/bookmarks.ts';
import { useSettingsStore } from '../stores/settings.ts';
import { useOperationsStore } from '../stores/operations.ts';
import { computeSortedChildren, isPermanentFolder } from '../lib/bookmark-utils.ts';
import { assignStylesToTree, collectFolderIdentities } from '../lib/folder-style-assignment.ts';
import { loadFolderStyleRecords, saveFolderStyleRecord } from '../lib/folder-style-storage.ts';
import { getVisibleRoots } from '../lib/tree-logic.ts';
import { t } from '../lib/i18n.ts';
import { withGlobalBookmarkMutation } from '../lib/bookmark-mutation-lock.ts';
import type { BookmarkNode } from '../types.ts';

const ICON = {
  addBookmark:
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path><line x1="12" y1="7" x2="12" y2="13"></line><line x1="9" y1="10" x2="15" y2="10"></line></svg>',
  addFolder:
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>',
  sort:
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h13"></path><path d="M3 12h9"></path><path d="M3 18h5"></path><path d="M18 6v12"></path><path d="M15 15l3 3 3-3"></path></svg>',
  edit:
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
  del:
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>',
  folderStyle:
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
};

interface ModalData {
  title?: string;
  url?: string;
  color?: string;
  icon?: string;
}

function readFreshBookmarkTree(): Promise<BookmarkNode[]> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((tree) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(tree);
    });
  });
}

function readBookmarkNode(id: string): Promise<BookmarkNode> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.get(id, (nodes) => {
      if (chrome.runtime.lastError || !nodes[0]) reject(new Error(chrome.runtime.lastError?.message ?? 'Bookmark not found'));
      else resolve(nodes[0]);
    });
  });
}

function MenuItem({ svg, label, danger, onClick }: { svg: string; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" className={`menu-item${danger ? ' menu-item-danger' : ''}`} onClick={onClick}>
      <span dangerouslySetInnerHTML={{ __html: svg }} />
      {label}
    </button>
  );
}

export function ContextMenu() {
  const target = useContextMenuStore((s) => s.target);
  const x = useContextMenuStore((s) => s.x);
  const y = useContextMenuStore((s) => s.y);
  const close = useContextMenuStore((s) => s.close);
  const trigger = useContextMenuStore((s) => s.trigger);
  const mutationBusy = useOperationsStore((s) => s.bookmarkMutationBusy);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    if (!target || !menuRef.current) return;
    const margin = 8;
    const rect = menuRef.current.getBoundingClientRect();
    setPosition({
      left: Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin)),
      top: Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin)),
    });
  }, [target, x, y, mutationBusy]);

  useEffect(() => {
    if (!target) return;
    const onClose = () => close();
    const frame = requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus());
    document.addEventListener('click', onClose);
    document.addEventListener('scroll', onClose, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('click', onClose);
      document.removeEventListener('scroll', onClose, true);
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [target, close, trigger]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      items[(current + offset + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      event.stopPropagation();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      event.stopPropagation();
      items[items.length - 1]?.focus();
    }
  };

  if (!target) return null;

  const isFolder = !target.url;
  const isManaged = Boolean(target.unmodifiable);
  if (isManaged && !isFolder) return null; // managed bookmark: no actions

  const isPermanent = isPermanentFolder(target);
  const restricted = isPermanent || isManaged;
  const showAdd = !isManaged && !mutationBusy;
  const showSort = isFolder && !isManaged && !mutationBusy;
  const showEdit = !restricted && !mutationBusy;
  const showDelete = !restricted && !mutationBusy;
  const showFolderStyle = isFolder && !mutationBusy;

  const openModal = useModalStore.getState().openCustomModal;
  const beginMutation = () => {
    const operations = useOperationsStore.getState();
    return operations.tryBeginMutation() ? operations : null;
  };

  const addBookmark = async () => {
    close();
    const data = (await openModal({ title: t('context_add_bookmark'), mode: 'input', showFields: ['title', 'url'], fieldsVal: { title: '', url: 'https://' } })) as ModalData | false;
    if (!data) return;
    const operations = beginMutation();
    if (!operations) return;
    void withGlobalBookmarkMutation(async () => {
      const latestTarget = await readBookmarkNode(target.id);
      const parentId = latestTarget.url ? latestTarget.parentId || '1' : latestTarget.id;
      await new Promise<void>((resolve) => {
        chrome.bookmarks.create({ parentId, title: data.title, url: data.url }, () => resolve());
      });
    }).catch(() => undefined).finally(() => operations.finishMutation());
  };

  const addFolder = async () => {
    close();
    const data = (await openModal({ title: t('context_add_folder'), mode: 'input', showFields: ['title'], fieldsVal: { title: '' } })) as ModalData | false;
    if (!data) return;
    const operations = beginMutation();
    if (!operations) return;
    void withGlobalBookmarkMutation(async () => {
      const latestTarget = await readBookmarkNode(target.id);
      const parentId = latestTarget.url ? latestTarget.parentId || '1' : latestTarget.id;
      await new Promise<void>((resolve) => {
        chrome.bookmarks.create({ parentId, title: data.title }, () => resolve());
      });
    }).catch(() => undefined).finally(() => operations.finishMutation());
  };

  const sort = async () => {
    close();
    const ok = await openModal({
      title: t('context_sort_by_name'),
      message: t('context_sort_message', target.title || t('context_this_folder')),
      mode: 'confirm',
      submitLabel: t('common_sort'),
    });
    if (!ok) return;
    const operations = beginMutation();
    if (!operations) return;
    void withGlobalBookmarkMutation(() => new Promise<void>((resolve) => {
      const store = useBookmarksStore.getState();
      chrome.bookmarks.getChildren(target.id, (children) => {
        if (chrome.runtime.lastError) {
          resolve();
          return;
        }
        const sorted = computeSortedChildren(children || []);
        store.beginBatch();
        let index = 0;
        const moveNext = () => {
          if (index >= sorted.length) {
            store.endBatch();
            resolve();
            return;
          }
          chrome.bookmarks.move(sorted[index]!.id, { parentId: target.id, index }, () => {
            index += 1;
            moveNext();
          });
        };
        moveNext();
      });
    })).finally(() => operations.finishMutation());
  };

  const edit = async () => {
    close();
    if (target.url) {
      const data = (await openModal({ title: t('context_edit_bookmark'), mode: 'input', showFields: ['title', 'url'], fieldsVal: { title: target.title, url: target.url } })) as ModalData | false;
      if (!data) return;
      const operations = beginMutation();
      if (!operations) return;
      void withGlobalBookmarkMutation(() => new Promise<void>((resolve) => {
        chrome.bookmarks.update(target.id, { title: data.title, url: data.url }, () => resolve());
      })).finally(() => operations.finishMutation());
      return;
    }
    const data = (await openModal({ title: t('context_rename_folder'), mode: 'input', showFields: ['title'], fieldsVal: { title: target.title } })) as ModalData | false;
    if (!data) return;
    const operations = beginMutation();
    if (!operations) return;
    void withGlobalBookmarkMutation(() => new Promise<void>((resolve) => {
      chrome.bookmarks.update(target.id, { title: data.title }, () => resolve());
    })).finally(() => operations.finishMutation());
  };

  const del = async () => {
    close();
    const message = t(target.url ? 'context_delete_bookmark_message' : 'context_delete_folder_message', target.title);
    const ok = await openModal({ title: t('context_delete_confirmation'), message, mode: 'confirm', submitLabel: t('common_delete') });
    if (!ok) return;
    const operations = beginMutation();
    if (!operations) return;
    void withGlobalBookmarkMutation(() => new Promise<void>((resolve) => {
      if (target.url) chrome.bookmarks.remove(target.id, () => resolve());
      else chrome.bookmarks.removeTree(target.id, () => resolve());
    })).finally(() => operations.finishMutation());
  };

  const folderStyle = async () => {
    close();
    const roots = getVisibleRoots(useBookmarksStore.getState().tree, useSettingsStore.getState().showOtherBookmarks);
    const styles = useFolderStylesStore.getState().styles;
    const record = assignStylesToTree(roots, styles).get(target.id) ?? null;
    const current = record ? { color: record.color || '', icon: record.icon || 'default' } : { color: '', icon: 'default' };
    const data = (await openModal({ title: t('context_folder_style'), mode: 'input', showFields: ['folderStyle'], fieldsVal: current })) as ModalData | false;
    if (!data) return;
    const operations = beginMutation();
    if (!operations) return;
    let unableToLoadFolder = false;
    try {
      await withGlobalBookmarkMutation(async () => {
        let latestRoots: BookmarkNode[];
        try {
          latestRoots = getVisibleRoots(await readFreshBookmarkTree(), true);
        } catch {
          unableToLoadFolder = true;
          throw new Error('Unable to load bookmark tree');
        }
        const latestIdentities = collectFolderIdentities(latestRoots);
        const latestIdentity = latestIdentities.find((folder) => folder.id === target.id);
        if (!latestIdentity) {
          unableToLoadFolder = true;
          throw new Error('Folder no longer exists');
        }
        // Re-read inside the mutation lock so the edit uses the latest local
        // bookmark and style snapshot.
        const latestStyles = await loadFolderStyleRecords();
        const latestRecord = assignStylesToTree(latestRoots, latestStyles).get(target.id) ?? null;
        const saved = await saveFolderStyleRecord(
          latestRecord,
          latestIdentity,
          { color: data.color, icon: data.icon }
        );
        const next = latestStyles.filter((item) => item !== latestRecord);
        if (saved) next.push(saved);
        useFolderStylesStore.getState().setStyles(next);
      });
      void useFolderStylesStore.getState().reload();
    } catch {
      await useModalStore.getState().showInfoDialog({
        title: t('common_error'),
        message: t(unableToLoadFolder ? 'actions_unable_load' : 'common_storage_error'),
      });
    } finally {
      operations.finishMutation();
    }
  };

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={target.title || t('common_bookmarks')}
      className="context-menu"
      style={{ display: 'block', position: 'fixed', top: position.top, left: position.left }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={onMenuKeyDown}
    >
      {showAdd && <MenuItem svg={ICON.addBookmark} label={t('context_add_bookmark')} onClick={addBookmark} />}
      {showAdd && <MenuItem svg={ICON.addFolder} label={t('context_add_folder')} onClick={addFolder} />}
      {showSort && <MenuItem svg={ICON.sort} label={t('context_sort_by_name')} onClick={sort} />}
      {(showEdit || showDelete) && <div className="menu-separator" />}
      {showEdit && <MenuItem svg={ICON.edit} label={t('context_rename_edit')} onClick={edit} />}
      {showDelete && <MenuItem svg={ICON.del} label={t('common_delete')} danger onClick={del} />}
      {showFolderStyle && <div className="menu-separator folder-style-sep" />}
      {showFolderStyle && <MenuItem svg={ICON.folderStyle} label={t('context_folder_style')} onClick={folderStyle} />}
    </div>,
    document.body
  );
}
