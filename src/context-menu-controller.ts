  function createContextMenuController({
    document,
    windowObj,
    chromeApi,
    treeContainer,
    modalDialog,
    getFolderStyles,
    setFolderStyles,
    loadBookmarks,
    reportChromeError,
    getAssignedStyle,
    getFolderIdentity,
    refreshRecordMetadata,
    replaceFolderStyle,
    computeSortedChildren,
    beginBatchUpdates,
    endBatchUpdates
  }) {
    const PERMANENT_FOLDER_IDS = ['1', '2', '3'];
    const contextMenu = document.getElementById('custom-context-menu');
    const menuAddBookmark = document.getElementById('menu-add-bookmark');
    const menuAddFolder = document.getElementById('menu-add-folder');
    const menuSort = document.getElementById('menu-sort');
    const menuEdit = document.getElementById('menu-edit');
    const menuDelete = document.getElementById('menu-delete');
    const menuFolderStyle = document.getElementById('menu-folder-style');
    const { openCustomModal } = modalDialog;

    let contextTargetNode = null;
    let contextIsRoot = false;

    function setMenuItemVisibility(item, visible) {
      item.style.display = visible ? 'flex' : 'none';
    }

    function showSeparator(selector, visible) {
      const separator = document.querySelector(selector);
      if (separator) {
        separator.style.display = visible ? 'block' : 'none';
      }
    }

    function showContextMenu(x, y) {
      // A managed (policy) bookmark supports no menu action at all — showing
      // an empty menu frame would be worse than showing nothing.
      if (contextTargetNode && contextTargetNode.unmodifiable && contextTargetNode.url) {
        hideContextMenu();
        return;
      }

      contextMenu.style.display = 'flex';
      const rect = contextMenu.getBoundingClientRect();
      const left = Math.min(x, windowObj.innerWidth - rect.width - 8);
      const top = Math.min(y, windowObj.innerHeight - rect.height - 8);
      contextMenu.style.left = `${Math.max(8, left)}px`;
      contextMenu.style.top = `${Math.max(8, top)}px`;

      const isFolder = !contextTargetNode.url;
      const isPermanent = PERMANENT_FOLDER_IDS.includes(contextTargetNode.id);
      // Policy-managed nodes reject every bookmarks-API write.
      const isManaged = Boolean(contextTargetNode.unmodifiable);
      setMenuItemVisibility(menuSort, isFolder && !isManaged);
      setMenuItemVisibility(menuAddBookmark, !isManaged);
      setMenuItemVisibility(menuAddFolder, !isManaged);

      if (contextIsRoot || isPermanent || isManaged) {
        // Chrome's permanent folders can be styled and sorted but never
        // renamed or deleted; managed folders can only be styled; the root
        // background gets neither.
        const allowStyle = isFolder && !contextIsRoot;
        setMenuItemVisibility(menuEdit, false);
        setMenuItemVisibility(menuDelete, false);
        setMenuItemVisibility(menuFolderStyle, allowStyle);
        showSeparator('.menu-separator', false);
        showSeparator('.folder-style-sep', allowStyle);
        return;
      }

      setMenuItemVisibility(menuEdit, true);
      setMenuItemVisibility(menuDelete, true);
      showSeparator('.menu-separator', true);

      setMenuItemVisibility(menuFolderStyle, isFolder);
      showSeparator('.folder-style-sep', isFolder);
    }

    function hideContextMenu() {
      contextMenu.style.display = 'none';
    }

    function bindContextMenu(element, node) {
      element.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        contextTargetNode = node;
        contextIsRoot = false;
        showContextMenu(event.clientX, event.clientY);
        event.stopPropagation();
      });
    }

    treeContainer.addEventListener('contextmenu', (event) => {
      if (event.target === treeContainer || event.target.tagName === 'UL') {
        event.preventDefault();
        contextTargetNode = { id: '1', title: 'Bookmarks Bar' };
        contextIsRoot = true;
        showContextMenu(event.clientX, event.clientY);
      }
    });

    document.addEventListener('click', hideContextMenu);

    const contentEl = document.querySelector('.content');
    if (contentEl) {
      contentEl.addEventListener('scroll', hideContextMenu);
    }

    menuAddBookmark.addEventListener('click', () => {
      if (!contextTargetNode) return;
      const parentId = (!contextTargetNode.url && !contextIsRoot) ? contextTargetNode.id : (contextTargetNode.parentId || '1');

      openCustomModal({
        title: 'Add Bookmark',
        showFields: ['title', 'url'],
        fieldsVal: { title: '', url: 'https://' },
        onSubmit: (data) => {
          chromeApi.bookmarks.create({
            parentId,
            title: data.title,
            url: data.url
          });
        }
      });
    });

    menuAddFolder.addEventListener('click', () => {
      if (!contextTargetNode) return;
      const parentId = (!contextTargetNode.url && !contextIsRoot) ? contextTargetNode.id : (contextTargetNode.parentId || '1');

      openCustomModal({
        title: 'Add Folder',
        showFields: ['title'],
        fieldsVal: { title: '' },
        onSubmit: (data) => {
          chromeApi.bookmarks.create({
            parentId,
            title: data.title
          });
        }
      });
    });

    function runFolderSort(folderId) {
      chromeApi.bookmarks.getChildren(folderId, (children) => {
        if (chromeApi.runtime.lastError) {
          reportChromeError('Error sorting folder');
          return;
        }
        const sorted = computeSortedChildren(children || []);
        beginBatchUpdates();
        let index = 0;
        const moveNext = () => {
          if (index >= sorted.length) {
            endBatchUpdates();
            return;
          }
          chromeApi.bookmarks.move(sorted[index].id, { parentId: folderId, index }, () => {
            reportChromeError('Error sorting folder');
            index += 1;
            moveNext();
          });
        };
        moveNext();
      });
    }

    menuSort.addEventListener('click', () => {
      if (!contextTargetNode || contextTargetNode.url) return;
      const folderId = contextTargetNode.id;
      const folderTitle = contextTargetNode.title || 'this folder';

      openCustomModal({
        title: 'Sort by Name',
        message: `Sort the contents of "${folderTitle}" alphabetically (folders first)? This reorders bookmarks permanently.`,
        mode: 'confirm',
        submitLabel: 'Sort',
        onSubmit: () => {
          runFolderSort(folderId);
        }
      });
    });

    menuEdit.addEventListener('click', () => {
      if (!contextTargetNode || contextIsRoot) return;

      if (contextTargetNode.url) {
        openCustomModal({
          title: 'Edit Bookmark',
          showFields: ['title', 'url'],
          fieldsVal: { title: contextTargetNode.title, url: contextTargetNode.url },
          onSubmit: (data) => {
            chromeApi.bookmarks.update(contextTargetNode.id, {
              title: data.title,
              url: data.url
            });
          }
        });
        return;
      }

      openCustomModal({
        title: 'Rename Folder',
        showFields: ['title'],
        fieldsVal: { title: contextTargetNode.title },
        onSubmit: (data) => {
          chromeApi.bookmarks.update(contextTargetNode.id, {
            title: data.title
          });
        }
      });
    });

    menuDelete.addEventListener('click', () => {
      if (!contextTargetNode || contextIsRoot) return;

      const confirmMsg = contextTargetNode.url
        ? `Are you sure you want to delete bookmark "${contextTargetNode.title}"?`
        : `Are you sure you want to delete folder "${contextTargetNode.title}" and all its contents?`;

      openCustomModal({
        title: 'Delete Confirmation',
        message: confirmMsg,
        mode: 'confirm',
        submitLabel: 'Delete',
        onSubmit: () => {
          if (contextTargetNode.url) {
            chromeApi.bookmarks.remove(contextTargetNode.id);
          } else {
            chromeApi.bookmarks.removeTree(contextTargetNode.id);
          }
        }
      });
    });

    menuFolderStyle.addEventListener('click', () => {
      if (!contextTargetNode || contextIsRoot) return;

      const folderIdentity = {
        dateAdded: contextTargetNode.dateAdded,
        title: contextTargetNode.title,
        path: contextTargetNode.stylePath || [contextTargetNode.title]
      };
      const record = getAssignedStyle(contextTargetNode.id);
      const currentStyle = record
        ? { color: record.color || '', icon: record.icon || 'default' }
        : { color: '', icon: 'default' };

      openCustomModal({
        title: 'Folder Style',
        showFields: ['folderStyle'],
        fieldsVal: currentStyle,
        onSubmit: (data) => {
          // Re-resolve at submit time: the styles array (or the folder's
          // title/path) may have changed while the dialog was open.
          const currentRecord = getAssignedStyle(contextTargetNode.id) || record;
          const currentIdentity = getFolderIdentity(contextTargetNode.id) || folderIdentity;
          const nextStyles = refreshRecordMetadata(
            replaceFolderStyle(getFolderStyles(), currentRecord, currentIdentity, data)
          );
          setFolderStyles(nextStyles);
          chromeApi.storage.sync.set({ folderStyles: nextStyles }, () => {
            if (chromeApi.runtime.lastError) {
              reportChromeError('Error saving folder style');
              return;
            }
            loadBookmarks(true);
          });
        }
      });
    });

    return {
      bindContextMenu,
      hideContextMenu
    };
  }

  export {
    createContextMenuController
  };
