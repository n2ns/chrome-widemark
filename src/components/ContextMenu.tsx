import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useContextMenuStore } from '../stores/contextMenu.ts';
import { useModalStore } from '../stores/modal.ts';
import { useFolderStylesStore } from '../stores/folderStyles.ts';
import { useBookmarksStore } from '../stores/bookmarks.ts';
import { useSettingsStore } from '../stores/settings.ts';
import { computeSortedChildren, replaceFolderStyle } from '../lib/bookmark-utils.ts';
import { assignStylesToTree, collectFolderIdentities } from '../lib/folder-style-assignment.ts';
import { getVisibleRoots } from '../lib/tree-logic.ts';

const PERMANENT_FOLDER_IDS = ['1', '2', '3'];

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

function MenuItem({ svg, label, danger, onClick }: { svg: string; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button className={`menu-item${danger ? ' menu-item-danger' : ''}`} onClick={onClick}>
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

  useEffect(() => {
    if (!target) return;
    const onClose = () => close();
    document.addEventListener('click', onClose);
    document.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('click', onClose);
      document.removeEventListener('scroll', onClose, true);
    };
  }, [target, close]);

  if (!target) return null;

  const isFolder = !target.url;
  const isManaged = Boolean(target.unmodifiable);
  if (isManaged && !isFolder) return null; // managed bookmark: no actions

  const isPermanent = PERMANENT_FOLDER_IDS.includes(target.id);
  const restricted = isPermanent || isManaged;
  const showAdd = !isManaged;
  const showSort = isFolder && !isManaged;
  const showEdit = !restricted;
  const showDelete = !restricted;
  const showFolderStyle = isFolder;

  const openModal = useModalStore.getState().openCustomModal;
  const parentId = isFolder ? target.id : target.parentId || '1';

  const addBookmark = async () => {
    close();
    const data = (await openModal({ title: 'Add Bookmark', mode: 'input', showFields: ['title', 'url'], fieldsVal: { title: '', url: 'https://' } })) as ModalData | false;
    if (!data) return;
    chrome.bookmarks.create({ parentId, title: data.title, url: data.url });
  };

  const addFolder = async () => {
    close();
    const data = (await openModal({ title: 'Add Folder', mode: 'input', showFields: ['title'], fieldsVal: { title: '' } })) as ModalData | false;
    if (!data) return;
    chrome.bookmarks.create({ parentId, title: data.title });
  };

  const sort = async () => {
    close();
    const ok = await openModal({
      title: 'Sort by Name',
      message: `Sort the contents of "${target.title || 'this folder'}" alphabetically (folders first)? This reorders bookmarks permanently.`,
      mode: 'confirm',
      submitLabel: 'Sort',
    });
    if (!ok) return;
    const store = useBookmarksStore.getState();
    chrome.bookmarks.getChildren(target.id, (children) => {
      if (chrome.runtime.lastError) return;
      const sorted = computeSortedChildren(children || []);
      store.beginBatch();
      let index = 0;
      const moveNext = () => {
        if (index >= sorted.length) {
          store.endBatch();
          return;
        }
        chrome.bookmarks.move(sorted[index]!.id, { parentId: target.id, index }, () => {
          index += 1;
          moveNext();
        });
      };
      moveNext();
    });
  };

  const edit = async () => {
    close();
    if (target.url) {
      const data = (await openModal({ title: 'Edit Bookmark', mode: 'input', showFields: ['title', 'url'], fieldsVal: { title: target.title, url: target.url } })) as ModalData | false;
      if (!data) return;
      chrome.bookmarks.update(target.id, { title: data.title, url: data.url });
      return;
    }
    const data = (await openModal({ title: 'Rename Folder', mode: 'input', showFields: ['title'], fieldsVal: { title: target.title } })) as ModalData | false;
    if (!data) return;
    chrome.bookmarks.update(target.id, { title: data.title });
  };

  const del = async () => {
    close();
    const message = target.url
      ? `Are you sure you want to delete bookmark "${target.title}"?`
      : `Are you sure you want to delete folder "${target.title}" and all its contents?`;
    const ok = await openModal({ title: 'Delete Confirmation', message, mode: 'confirm', submitLabel: 'Delete' });
    if (!ok) return;
    if (target.url) chrome.bookmarks.remove(target.id);
    else chrome.bookmarks.removeTree(target.id);
  };

  const folderStyle = async () => {
    close();
    const roots = getVisibleRoots(useBookmarksStore.getState().tree, useSettingsStore.getState().showOtherBookmarks);
    const styles = useFolderStylesStore.getState().styles;
    const record = assignStylesToTree(roots, styles).get(target.id) ?? null;
    const identity = collectFolderIdentities(roots).find((f) => f.id === target.id) ?? {
      dateAdded: target.dateAdded,
      title: target.title,
      path: [target.title],
    };
    const current = record ? { color: record.color || '', icon: record.icon || 'default' } : { color: '', icon: 'default' };
    const data = (await openModal({ title: 'Folder Style', mode: 'input', showFields: ['folderStyle'], fieldsVal: current })) as ModalData | false;
    if (!data) return;
    const next = replaceFolderStyle(
      styles,
      record,
      { dateAdded: identity.dateAdded, title: identity.title, path: identity.path },
      { color: data.color, icon: data.icon }
    );
    useFolderStylesStore.getState().setStyles(next);
    chrome.storage.sync.set({ folderStyles: next });
  };

  return createPortal(
    <div
      className="context-menu"
      style={{ display: 'block', position: 'fixed', top: y, left: x }}
      onClick={(event) => event.stopPropagation()}
    >
      {showAdd && <MenuItem svg={ICON.addBookmark} label="Add Bookmark" onClick={addBookmark} />}
      {showAdd && <MenuItem svg={ICON.addFolder} label="Add Folder" onClick={addFolder} />}
      {showSort && <MenuItem svg={ICON.sort} label="Sort by Name" onClick={sort} />}
      {(showEdit || showDelete) && <div className="menu-separator" />}
      {showEdit && <MenuItem svg={ICON.edit} label="Rename / Edit" onClick={edit} />}
      {showDelete && <MenuItem svg={ICON.del} label="Delete" danger onClick={del} />}
      {showFolderStyle && <div className="menu-separator folder-style-sep" />}
      {showFolderStyle && <MenuItem svg={ICON.folderStyle} label="Folder Style" onClick={folderStyle} />}
    </div>,
    document.body
  );
}
