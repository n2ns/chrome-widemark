(function attachWideMarkContextMenu(root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.WideMarkContextMenu = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createWideMarkContextMenuApi() {
  function createContextMenuController({
    document,
    windowObj,
    chromeApi,
    treeContainer,
    modalDialog,
    getFolderStyles,
    setFolderStyles,
    loadBookmarks,
    reportChromeError
  }) {
    const contextMenu = document.getElementById('custom-context-menu');
    const menuAddBookmark = document.getElementById('menu-add-bookmark');
    const menuAddFolder = document.getElementById('menu-add-folder');
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
      contextMenu.style.display = 'flex';
      const rect = contextMenu.getBoundingClientRect();
      const left = Math.min(x, windowObj.innerWidth - rect.width - 8);
      const top = Math.min(y, windowObj.innerHeight - rect.height - 8);
      contextMenu.style.left = `${Math.max(8, left)}px`;
      contextMenu.style.top = `${Math.max(8, top)}px`;

      if (contextIsRoot || contextTargetNode.id === '1') {
        setMenuItemVisibility(menuEdit, false);
        setMenuItemVisibility(menuDelete, false);
        setMenuItemVisibility(menuFolderStyle, false);
        showSeparator('.menu-separator', false);
        showSeparator('.folder-style-sep', false);
        return;
      }

      setMenuItemVisibility(menuEdit, true);
      setMenuItemVisibility(menuDelete, true);
      showSeparator('.menu-separator', true);

      const isFolder = !contextTargetNode.url;
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

      const currentStyles = getFolderStyles();
      const currentStyle = currentStyles[contextTargetNode.id] || { color: '', icon: 'default' };

      openCustomModal({
        title: 'Folder Style',
        showFields: ['folderStyle'],
        fieldsVal: currentStyle,
        onSubmit: (data) => {
          const nextStyles = {
            ...getFolderStyles(),
            [contextTargetNode.id]: data
          };
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

  return {
    createContextMenuController
  };
});
