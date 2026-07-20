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
    assignFolderStyles,
    icons
  }) {
    const RECENT_SECTION_ID = 'recent-section';
    const RECENT_COUNT = 10;
    // Chrome's permanent root folders: Bookmarks Bar, Other, Mobile.
    const PERMANENT_FOLDER_IDS = ['1', '2', '3'];

    let expandedFolderIds = new Set();
    let draggedNodeId = null;
    let draggedNode = null;
    let styleAssignment = new Map();
    let folderIdentityById = new Map();

    function persistExpandedState() {
      chromeApi.storage.local.set({ expandedFolderIds: [...expandedFolderIds] }, () => {
        reportChromeError('Error saving expanded folders');
      });
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

        const finishRender = (recentNodes) => {
          renderBookmarkTree(bookmarkTreeNodes, recentNodes);
          updateToggleAllButton();
          if (contentContainer) {
            contentContainer.scrollTop = savedScrollTop;
          }
        };

        if (state.showRecent) {
          chromeApi.bookmarks.getRecent(RECENT_COUNT, (recent) => {
            finishRender(chromeApi.runtime.lastError ? [] : (recent || []));
          });
        } else {
          finishRender([]);
        }
      });
    }

    function collectFolders(nodes, parentPath = [], out = []) {
      nodes.forEach((node) => {
        if (node.url) return;
        node.stylePath = [...parentPath, node.title];
        const identity = { id: node.id, dateAdded: node.dateAdded, title: node.title, path: node.stylePath };
        out.push(identity);
        folderIdentityById.set(node.id, identity);
        if (node.children) {
          collectFolders(node.children, node.stylePath, out);
        }
      });
      return out;
    }

    // Bring the title/path metadata of every currently assigned record up to
    // date. Called only from explicit user style edits (the result is
    // persisted by the caller), so it cannot ping-pong between devices.
    function refreshRecordMetadata(records) {
      styleAssignment.forEach((record, nodeId) => {
        const identity = folderIdentityById.get(nodeId);
        if (!identity || !records.includes(record)) return;
        record.title = identity.title;
        record.path = identity.path;
      });
      return records;
    }

    function renderBookmarkTree(nodes, recentNodes = []) {
      treeContainer.innerHTML = '';
      styleAssignment = new Map();
      folderIdentityById = new Map();

      const rootNode = nodes[0];
      const topLevel = rootNode && rootNode.children ? rootNode.children : [];
      const bookmarksBarNode = findBookmarksBarNode(nodes);
      const barChildren = bookmarksBarNode ? (bookmarksBarNode.children || []) : [];
      const otherRoots = state.showOtherBookmarks
        ? topLevel.filter((node) => node !== bookmarksBarNode && !node.url)
        : [];

      if (barChildren.length === 0 && otherRoots.length === 0) {
        const message = state.showOtherBookmarks
          ? 'No bookmarks yet.'
          : 'No bookmarks in the Bookmarks Bar.';
        treeContainer.innerHTML = `
          <div class="empty-state">
            <span>${message}</span>
          </div>
        `;
        return;
      }

      const folderList = collectFolders(barChildren);
      otherRoots.forEach((root) => collectFolders([root], [], folderList));
      styleAssignment = assignFolderStyles(getFolderStyles(), folderList);

      const rootUl = createListNode(barChildren, true);
      otherRoots.forEach((root) => rootUl.appendChild(createTreeItem(root)));
      if (state.showRecent && recentNodes.length > 0) {
        rootUl.insertBefore(createRecentSection(recentNodes), rootUl.firstChild);
      }
      treeContainer.appendChild(rootUl);
      restoreFocusedRow();
    }

    function createRecentSection(recentNodes) {
      const li = document.createElement('li');

      const headerDiv = document.createElement('div');
      headerDiv.classList.add('tree-node', 'recent-section-header');
      headerDiv.dataset.nodeId = RECENT_SECTION_ID;

      const icon = document.createElement('span');
      icon.classList.add('node-icon', 'folder-icon');
      icon.innerHTML = icons.RECENT_ICON;

      const titleSpan = document.createElement('span');
      titleSpan.classList.add('node-title');
      titleSpan.textContent = 'Recently Added';

      headerDiv.appendChild(icon);
      headerDiv.appendChild(titleSpan);
      headerDiv.addEventListener('click', () => {
        toggleFolder(RECENT_SECTION_ID);
      });

      const childrenUl = document.createElement('ul');
      childrenUl.classList.add('nested-tree', 'folder-children');
      childrenUl.id = `folder-child-${RECENT_SECTION_ID}`;
      recentNodes.forEach((node) => {
        const itemLi = document.createElement('li');
        itemLi.appendChild(createBookmarkNode(node, { draggable: false }));
        childrenUl.appendChild(itemLi);
      });

      if (expandedFolderIds.has(RECENT_SECTION_ID)) {
        childrenUl.classList.add('visible');
        headerDiv.classList.add('expanded');
      }

      li.appendChild(headerDiv);
      li.appendChild(childrenUl);
      return li;
    }

    function createTreeItem(node) {
      const li = document.createElement('li');

      if (node.url) {
        li.appendChild(createBookmarkNode(node));
        return li;
      }

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
      return li;
    }

    function createListNode(nodes, isRoot = false) {
      const ul = document.createElement('ul');
      if (!isRoot) {
        ul.classList.add('nested-tree');
      }

      sortNodes(nodes).forEach((node) => {
        ul.appendChild(createTreeItem(node));
      });

      return ul;
    }

    function makeNodeDraggable(element, node) {
      // Managed (policy) nodes reject all bookmarks-API writes: neither
      // draggable nor a drop target.
      if (node.unmodifiable) {
        element.draggable = false;
        return;
      }

      const isPermanentFolder = PERMANENT_FOLDER_IDS.includes(node.id);
      element.draggable = !state.dragProtectionEnabled && !isPermanentFolder;

      element.addEventListener('dragstart', (event) => {
        if (state.dragProtectionEnabled || isPermanentFolder) {
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

        // Nothing can sit beside a permanent root folder — only inside it.
        const dropPosition = isPermanentFolder
          ? 'inside'
          : determineDropPosition(y, height, isFolder);
        applyDropIndicator(element, dropPosition);
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
        const dropPos = isPermanentFolder
          ? 'inside'
          : determineDropPosition(event.clientY - rect.top, rect.height, !node.url);
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

    function createBookmarkNode(node, { draggable = true } = {}) {
      const div = document.createElement('div');
      div.classList.add('tree-node', 'bookmark-item');
      div.dataset.url = node.url;
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

      // Middle clicks fire 'auxclick', not 'click', in Chrome.
      div.addEventListener('auxclick', (event) => {
        if (event.button === 1) {
          handleBookmarkClick(node.url, event);
        }
      });

      if (draggable) {
        makeNodeDraggable(div, node);
      }
      bindContextMenu(div, node);

      return div;
    }

    function createFolderNode(node) {
      const div = document.createElement('div');
      div.classList.add('tree-node');
      div.dataset.nodeId = node.id;

      const icon = document.createElement('span');
      icon.classList.add('node-icon', 'folder-icon');

      const customStyle = styleAssignment.get(node.id) || null;
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

      persistExpandedState();
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

    function searchBookmarks(query, silent = false) {
      if (!silent) {
        showLoading();
      }
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
      searchResultsHeader.classList.add('search-results-header');
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
      restoreFocusedRow();
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
          // The Recently Added pseudo-folder is not part of the bookmark
          // tree; expand-all must not silently collapse it.
          const recentWasExpanded = expandedFolderIds.has(RECENT_SECTION_ID);
          expandedFolderIds = new Set(gatherFolderIds(bookmarkTreeNodes));
          if (recentWasExpanded) expandedFolderIds.add(RECENT_SECTION_ID);
          persistExpandedState();
          loadBookmarks(true);
        });
      } else {
        expandedFolderIds.clear();
        persistExpandedState();
        loadBookmarks(true);
      }
    }

    // Refresh whatever the panel is currently showing: an active search is
    // re-run in place instead of being replaced by the tree. Text left in a
    // hidden search box (e.g. after Restore Defaults) must not count as an
    // active search.
    function refreshView() {
      const query = searchInput.value.trim();
      if (state.isSearchOpen && shouldSearchBookmarks(query)) {
        searchBookmarks(query, true);
      } else {
        loadBookmarks(true);
      }
    }

    function initTree() {
      chromeApi.storage.local.get(['expandedFolderIds'], (result) => {
        expandedFolderIds = Array.isArray(result.expandedFolderIds)
          ? new Set(result.expandedFolderIds)
          : new Set();
        updateToggleAllButton();
        if (state.isFoldersExpanded) {
          applyFoldersExpandedState();
        } else {
          loadBookmarks(true);
        }
      });
    }

    let focusedRow = null;
    let focusedRowKey = null;

    function visibleTreeRows() {
      return [...treeContainer.querySelectorAll('.tree-node')]
        .filter((element) => element.offsetParent !== null);
    }

    function setFocusedRow(row) {
      if (focusedRow) focusedRow.classList.remove('kb-focus');
      focusedRow = row;
      if (focusedRow) {
        focusedRow.classList.add('kb-focus');
        focusedRow.scrollIntoView({ block: 'nearest' });
        focusedRowKey = focusedRow.dataset.nodeId
          ? { attr: 'data-node-id', value: focusedRow.dataset.nodeId }
          : { attr: 'data-url', value: focusedRow.dataset.url || '' };
      } else {
        focusedRowKey = null;
      }
    }

    // Re-renders replace the DOM; re-attach keyboard focus to the row with
    // the same identity so navigation continues where it was. Only visible
    // rows qualify, and the copy outside the Recently Added section wins
    // when a bookmark appears in both places.
    function restoreFocusedRow() {
      if (!focusedRowKey) return;
      const matches = visibleTreeRows().filter(
        (element) => element.getAttribute(focusedRowKey.attr) === focusedRowKey.value
      );
      const row = matches.find(
        (element) => !element.closest(`#folder-child-${RECENT_SECTION_ID}`)
      ) || matches[0] || null;
      focusedRow = row;
      if (focusedRow) {
        focusedRow.classList.add('kb-focus');
      } else {
        focusedRowKey = null;
      }
    }

    function focusedFolderChildren() {
      if (!focusedRow || focusedRow.dataset.url || !focusedRow.dataset.nodeId) return null;
      return document.getElementById(`folder-child-${focusedRow.dataset.nodeId}`);
    }

    function handleTreeKeydown(event) {
      const target = event.target;
      const isTyping = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      const modal = document.getElementById('custom-modal');
      const mainView = document.getElementById('main-view');
      if ((modal && modal.style.display === 'flex') ||
        (mainView && mainView.style.display === 'none')) {
        return;
      }

      // ArrowDown inside the search box jumps into the result list.
      if (isTyping) {
        if (target === searchInput && event.key === 'ArrowDown') {
          event.preventDefault();
          setFocusedRow(visibleTreeRows()[0] || null);
          searchInput.blur();
        }
        return;
      }

      const rows = visibleTreeRows();
      if (rows.length === 0) return;
      const currentIndex = focusedRow ? rows.indexOf(focusedRow) : -1;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setFocusedRow(rows[Math.min(currentIndex + 1, rows.length - 1)]);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setFocusedRow(rows[Math.max(currentIndex - 1, 0)]);
      } else if (event.key === 'Enter' && focusedRow) {
        event.preventDefault();
        if (focusedRow.dataset.url) {
          handleBookmarkClick(focusedRow.dataset.url, event);
        } else if (focusedRow.dataset.nodeId) {
          toggleFolder(focusedRow.dataset.nodeId);
        }
      } else if (event.key === 'ArrowRight') {
        const children = focusedFolderChildren();
        if (children && !children.classList.contains('visible')) {
          event.preventDefault();
          toggleFolder(focusedRow.dataset.nodeId);
        }
      } else if (event.key === 'ArrowLeft') {
        const children = focusedFolderChildren();
        if (children && children.classList.contains('visible')) {
          event.preventDefault();
          toggleFolder(focusedRow.dataset.nodeId);
        }
      }
    }

    function bindEvents() {
      document.addEventListener('keydown', handleTreeKeydown);

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
      initTree,
      getAssignedStyle: (nodeId) => styleAssignment.get(nodeId) || null,
      getFolderIdentity: (nodeId) => folderIdentityById.get(nodeId) || null,
      refreshRecordMetadata,
      handleBookmarkClick,
      loadBookmarks,
      refreshView,
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
