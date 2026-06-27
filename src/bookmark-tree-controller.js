(function attachWideMarkBookmarkTree(root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.WideMarkBookmarkTree = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createWideMarkBookmarkTreeApi() {
  function findBookmarksBarNode(nodes) {
    const rootNode = nodes[0];
    if (!rootNode || !rootNode.children) {
      return null;
    }
    return rootNode.children.find(child => child.id === '1') || rootNode.children[0] || null;
  }

  function gatherFolderIds(nodes, folderIds = []) {
    nodes.forEach(node => {
      if (!node.url) {
        folderIds.push(node.id);
        if (node.children) {
          gatherFolderIds(node.children, folderIds);
        }
      }
    });
    return folderIds;
  }

  function determineDropPosition(y, height, isFolder) {
    if (isFolder) {
      if (y < height * 0.25) return 'above';
      if (y > height * 0.75) return 'below';
      return 'inside';
    }
    return y < height / 2 ? 'above' : 'below';
  }

  function applyDropIndicator(element, dropPosition) {
    element.classList.remove('drag-above', 'drag-below', 'drag-over');
    if (dropPosition === 'above') {
      element.classList.add('drag-above');
    } else if (dropPosition === 'below') {
      element.classList.add('drag-below');
    } else if (dropPosition === 'inside') {
      element.classList.add('drag-over');
    }
    element.dataset.dropPosition = dropPosition;
  }

  function hasTransferType(dataTransfer, type) {
    return Array.prototype.includes.call(dataTransfer.types || [], type);
  }

  function firstUriListUrl(uriList) {
    return uriList
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(line => line && !line.startsWith('#')) || '';
  }

  function firstPlainTextUrl(text) {
    return text
      .trim()
      .split(/\s+/)
      .find(Boolean) || '';
  }

  function normalizeDroppedUrl(dataTransfer) {
    const uriListUrl = firstUriListUrl(dataTransfer.getData('text/uri-list') || '');
    const url = uriListUrl || firstPlainTextUrl(dataTransfer.getData('text/plain') || '');
    if (!url) return null;

    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return null;
      }
      return parsedUrl.href;
    } catch (_) {
      return null;
    }
  }

  function extractLinkInfo(dataTransfer) {
    const url = normalizeDroppedUrl(dataTransfer);
    if (!url) return null;

    let title = '';
    const html = dataTransfer.getData('text/html');
    if (html && typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const anchor = doc.querySelector('a');
      if (anchor) {
        title = (anchor.textContent || anchor.innerText || '').trim();
      }
    }
    if (!title) {
      try {
        const parsedUrl = new URL(url);
        title = parsedUrl.hostname + (parsedUrl.pathname !== '/' ? parsedUrl.pathname : '');
      } catch (_) {
        title = url;
      }
    }
    return { url, title: title.trim() };
  }

  function shouldSearchBookmarks(query) {
    return query.length > 0 && !(query.length === 1 && /^[\x00-\x7F]$/.test(query));
  }

  function normalizeSearchText(value) {
    return (value || '').trim().toLocaleLowerCase();
  }

  function compareText(a, b) {
    return normalizeSearchText(a).localeCompare(normalizeSearchText(b), undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  }

  function normalizeUrlForSearchRank(url) {
    return normalizeSearchText(url).replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^www\./, '');
  }

  function sortSearchResults(results, query) {
    const normalizedQuery = normalizeSearchText(query);

    function matchRank(item) {
      const title = normalizeSearchText(item.title);
      const url = normalizeSearchText(item.url);
      const rankedUrl = normalizeUrlForSearchRank(item.url);
      if (title.startsWith(normalizedQuery)) return 0;
      if (title.includes(normalizedQuery)) return 1;
      if (rankedUrl.startsWith(normalizedQuery)) return 2;
      if (url.includes(normalizedQuery)) return 3;
      return 4;
    }

    return [...results].sort((a, b) => {
      const rankDiff = matchRank(a) - matchRank(b);
      if (rankDiff !== 0) {
        return rankDiff;
      }

      return compareText(a.title || a.url, b.title || b.url) || compareText(a.url, b.url);
    });
  }

  function createBookmarkTreeController({
    document,
    chromeApi,
    state,
    treeContainer,
    searchInput,
    clearSearchBtn,
    toggleAllBtn,
    bindContextMenu,
    getFolderStyles,
    reportChromeError,
    bookmarkDomain,
    sortNodes,
    computeMoveDestination,
    icons
  }) {
    let expandedFolderIds = new Set();
    let draggedNodeId = null;
    let draggedNode = null;

    function saveExpandedState() {
      if (expandedFolderIds.size === 0 && state.isFoldersExpanded) {
        state.isFoldersExpanded = false;
        chromeApi.storage.local.set({ isFoldersExpanded: false });
        updateToggleAllButton();
      }
    }

    function showLoading() {
      treeContainer.innerHTML = `
        <div class="loading-state">
          <div class="spinner"></div>
          <span>Loading bookmarks...</span>
        </div>
      `;
    }

    function loadBookmarks(silent = false) {
      const contentContainer = document.querySelector('.content');
      const savedScrollTop = contentContainer ? contentContainer.scrollTop : 0;

      if (!silent) {
        showLoading();
      }

      chromeApi.bookmarks.getTree((bookmarkTreeNodes) => {
        if (chromeApi.runtime.lastError) {
          treeContainer.innerHTML = `
            <div class="empty-state">
              <span>Unable to load bookmarks.</span>
            </div>
          `;
          reportChromeError('Error loading bookmarks');
          return;
        }

        renderBookmarkTree(bookmarkTreeNodes);
        updateToggleAllButton();

        if (contentContainer) {
          contentContainer.scrollTop = savedScrollTop;
        }
      });
    }

    function renderBookmarkTree(nodes) {
      treeContainer.innerHTML = '';

      const bookmarksBarNode = findBookmarksBarNode(nodes);
      const rootChildren = bookmarksBarNode ? (bookmarksBarNode.children || []) : [];

      if (rootChildren.length === 0) {
        treeContainer.innerHTML = `
          <div class="empty-state">
            <span>No bookmarks found in Bookmarks Bar.</span>
          </div>
        `;
        return;
      }

      treeContainer.appendChild(createListNode(rootChildren, true));
    }

    function createListNode(nodes, isRoot = false) {
      const ul = document.createElement('ul');
      if (!isRoot) {
        ul.classList.add('nested-tree');
      }

      sortNodes(nodes).forEach((node) => {
        const li = document.createElement('li');

        if (node.url) {
          li.appendChild(createBookmarkNode(node));
        } else {
          const folderDiv = createFolderNode(node);
          li.appendChild(folderDiv);

          const childrenUl = createListNode(node.children || []);
          childrenUl.id = `folder-child-${node.id}`;
          childrenUl.classList.add('folder-children');

          if (expandedFolderIds.has(node.id)) {
            childrenUl.classList.add('visible');
            folderDiv.classList.add('expanded');
          }

          li.appendChild(childrenUl);
        }
        ul.appendChild(li);
      });

      return ul;
    }

    function makeNodeDraggable(element, node) {
      element.draggable = !state.dragProtectionEnabled;

      element.addEventListener('dragstart', (event) => {
        if (state.dragProtectionEnabled) {
          event.preventDefault();
          return;
        }
        draggedNodeId = node.id;
        draggedNode = node;
        event.dataTransfer.setData('text/plain', node.id);
        event.dataTransfer.setData('application/x-bookmark-id', node.id);
        element.classList.add('dragging');
        event.stopPropagation();
      });

      element.addEventListener('dragend', (event) => {
        if (state.dragProtectionEnabled) return;
        draggedNodeId = null;
        draggedNode = null;
        element.classList.remove('dragging');
        element.classList.remove('drag-above', 'drag-below', 'drag-over');
        event.stopPropagation();
      });

      element.addEventListener('dragover', (event) => {
        if (state.dragProtectionEnabled) return;

        if (draggedNodeId === node.id) return;

        const isInternal = hasTransferType(event.dataTransfer, 'application/x-bookmark-id');
        const isExternalLink = hasTransferType(event.dataTransfer, 'text/uri-list') || hasTransferType(event.dataTransfer, 'text/plain');
        if (!isInternal && !isExternalLink) return;

        event.preventDefault();
        event.stopPropagation();

        const rect = element.getBoundingClientRect();
        const y = event.clientY - rect.top;
        const height = rect.height;
        const isFolder = !node.url;

        applyDropIndicator(element, determineDropPosition(y, height, isFolder));
      });

      element.addEventListener('dragleave', (event) => {
        if (state.dragProtectionEnabled) return;
        element.classList.remove('drag-above', 'drag-below', 'drag-over');
        delete element.dataset.dropPosition;
        event.stopPropagation();
      });

      element.addEventListener('drop', (event) => {
        if (state.dragProtectionEnabled) return;
        event.preventDefault();
        event.stopPropagation();

        const rect = element.getBoundingClientRect();
        const dropPos = determineDropPosition(event.clientY - rect.top, rect.height, !node.url);
        element.classList.remove('drag-above', 'drag-below', 'drag-over');
        delete element.dataset.dropPosition;

        const isInternal = hasTransferType(event.dataTransfer, 'application/x-bookmark-id');

        if (isInternal) {
          const draggedId = event.dataTransfer.getData('application/x-bookmark-id') || draggedNodeId;
          if (!draggedId || draggedId === node.id) return;

          const moveDest = computeMoveDestination(draggedNode || { id: draggedId }, node, dropPos);

          chromeApi.bookmarks.move(draggedId, moveDest, () => {
            if (chromeApi.runtime.lastError) {
              reportChromeError('Error moving bookmark');
            }
          });
        } else {
          // External drag (hyperlink from webpage)
          const linkInfo = extractLinkInfo(event.dataTransfer);
          if (!linkInfo) return;

          const dest = computeMoveDestination(null, node, dropPos);

          chromeApi.bookmarks.create({
            parentId: dest.parentId,
            index: dest.index,
            title: linkInfo.title,
            url: linkInfo.url
          }, () => {
            if (chromeApi.runtime.lastError) {
              reportChromeError('Error creating bookmark from drag');
            }
          });
        }
      });
    }

    function createBookmarkNode(node) {
      const div = document.createElement('div');
      div.classList.add('tree-node', 'bookmark-item');
      if (state.tooltipEnabled) {
        div.title = `${node.title}\n${node.url}`;
      }

      const icon = document.createElement('img');
      icon.classList.add('node-icon');
      icon.src = icons.getBookmarkIconSrc({ chromeApi, bookmarkDomain, url: node.url });
      icon.alt = '';
      icon.onerror = () => {
        icon.src = icons.LINK_ICON_DATA_URI;
      };

      const titleSpan = document.createElement('span');
      titleSpan.classList.add('node-title');
      titleSpan.textContent = node.title || node.url;

      div.appendChild(icon);
      div.appendChild(titleSpan);

      div.addEventListener('click', (event) => {
        handleBookmarkClick(node.url, event);
      });

      makeNodeDraggable(div, node);
      bindContextMenu(div, node);

      return div;
    }

    function createFolderNode(node) {
      const div = document.createElement('div');
      div.classList.add('tree-node');
      div.dataset.nodeId = node.id;

      const icon = document.createElement('span');
      icon.classList.add('node-icon', 'folder-icon');

      const customStyle = getFolderStyles()[node.id];
      icon.innerHTML = customStyle && customStyle.icon && customStyle.icon !== 'default'
        ? icons.getFolderSvgIcon(customStyle.icon)
        : icons.getFolderSvgIcon('default');

      if (customStyle && customStyle.color) {
        icon.style.color = customStyle.color;
      }

      const titleSpan = document.createElement('span');
      titleSpan.classList.add('node-title');
      titleSpan.textContent = node.title;

      div.appendChild(icon);
      div.appendChild(titleSpan);

      div.addEventListener('click', () => {
        toggleFolder(node.id);
      });

      makeNodeDraggable(div, node);
      bindContextMenu(div, node);

      return div;
    }

    function toggleFolder(folderId) {
      const childrenUl = document.getElementById(`folder-child-${folderId}`);
      if (!childrenUl) return;

      const isVisible = childrenUl.classList.contains('visible');

      if (isVisible) {
        childrenUl.classList.remove('visible');
        childrenUl.previousElementSibling?.classList.remove('expanded');
        expandedFolderIds.delete(folderId);
      } else {
        childrenUl.classList.add('visible');
        childrenUl.previousElementSibling?.classList.add('expanded');
        expandedFolderIds.add(folderId);
      }

      saveExpandedState();
      updateToggleAllButton();
    }

    function handleBookmarkClick(url, event) {
      event.preventDefault();

      const forceNewTab = event.ctrlKey || event.metaKey || event.button === 1;

      if (forceNewTab) {
        chromeApi.tabs.create({ url, active: false }, () => reportChromeError('Error opening bookmark in new tab'));
        return;
      }

      if (state.leftClickAction === 'new-foreground') {
        chromeApi.tabs.create({ url, active: true }, () => reportChromeError('Error opening bookmark'));
      } else if (state.leftClickAction === 'new-background') {
        chromeApi.tabs.create({ url, active: false }, () => reportChromeError('Error opening bookmark'));
      } else {
        chromeApi.tabs.update({ url }, () => reportChromeError('Error opening bookmark'));
      }
    }

    function searchBookmarks(query) {
      showLoading();
      chromeApi.bookmarks.search(query, (results) => {
        if (chromeApi.runtime.lastError) {
          treeContainer.innerHTML = `
            <div class="empty-state">
              <span>Search failed.</span>
            </div>
          `;
          reportChromeError('Error searching bookmarks');
          return;
        }
        renderSearchResults(results, query);
      });
    }

    function renderSearchResults(results, query) {
      treeContainer.innerHTML = '';

      const linkResults = sortSearchResults(results.filter(node => node.url), query);

      if (linkResults.length === 0) {
        treeContainer.innerHTML = `
          <div class="empty-state">
            <span>No matching bookmarks found.</span>
          </div>
        `;
        return;
      }

      const searchResultsHeader = document.createElement('div');
      searchResultsHeader.style.padding = '4px 10px 8px 10px';
      searchResultsHeader.style.fontSize = '0.8rem';
      searchResultsHeader.style.color = 'var(--text-muted)';
      searchResultsHeader.textContent = `Found ${linkResults.length} bookmark(s):`;
      treeContainer.appendChild(searchResultsHeader);

      const ul = document.createElement('ul');
      ul.classList.add('search-results-list');
      ul.style.paddingLeft = '0';

      linkResults.forEach(node => {
        const li = document.createElement('li');
        li.appendChild(createBookmarkNode(node));
        ul.appendChild(li);
      });

      treeContainer.appendChild(ul);
    }

    function updateToggleAllButton() {
      if (!toggleAllBtn) return;
      if (state.isFoldersExpanded) {
        toggleAllBtn.classList.add('active');
        toggleAllBtn.title = 'Collapse all folders';
        toggleAllBtn.innerHTML = icons.toolbarIcons.collapseAll;
      } else {
        toggleAllBtn.classList.remove('active');
        toggleAllBtn.title = 'Expand all folders';
        toggleAllBtn.innerHTML = icons.toolbarIcons.expandAll;
      }
    }

    function applyFoldersExpandedState() {
      updateToggleAllButton();
      if (state.isFoldersExpanded) {
        chromeApi.bookmarks.getTree((bookmarkTreeNodes) => {
          if (chromeApi.runtime.lastError) {
            reportChromeError('Error expanding all bookmarks');
            return;
          }
          expandedFolderIds = new Set(gatherFolderIds(bookmarkTreeNodes));
          loadBookmarks(true);
        });
      } else {
        expandedFolderIds.clear();
        loadBookmarks(true);
      }
    }

    function bindEvents() {
      searchInput.addEventListener('input', (event) => {
        const query = event.target.value.trim();
        if (shouldSearchBookmarks(query)) {
          clearSearchBtn.style.display = 'block';
          searchBookmarks(query);
        } else if (query.length > 0) {
          clearSearchBtn.style.display = 'block';
          loadBookmarks(true);
        } else {
          clearSearchBtn.style.display = 'none';
          loadBookmarks(true);
        }
      });

      clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        loadBookmarks(true);
        searchInput.focus();
      });

      toggleAllBtn.addEventListener('click', () => {
        state.isFoldersExpanded = !state.isFoldersExpanded;
        chromeApi.storage.local.set({ isFoldersExpanded: state.isFoldersExpanded });
        applyFoldersExpandedState();
      });
    }

    bindEvents();

    return {
      applyFoldersExpandedState,
      handleBookmarkClick,
      loadBookmarks,
      searchBookmarks,
      updateToggleAllButton
    };
  }

  return {
    findBookmarksBarNode,
    gatherFolderIds,
    determineDropPosition,
    extractLinkInfo,
    shouldSearchBookmarks,
    sortSearchResults,
    createBookmarkTreeController
  };
});
