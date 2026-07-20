(function attachBookmarkSidebarUtils(root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.BookmarkSidebarUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createBookmarkSidebarUtils() {
  function bookmarkDomain(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.hostname : null;
    } catch (error) {
      return null;
    }
  }

  function sortNodes(nodesList) {
    return [...nodesList].sort((a, b) => {
      const aIndex = typeof a.index === 'number' ? a.index : 0;
      const bIndex = typeof b.index === 'number' ? b.index : 0;
      return aIndex - bIndex;
    });
  }

  function computeMoveDestination(draggedNode, targetNode, dropPosition) {
    if (dropPosition === 'inside') {
      return { parentId: targetNode.id };
    }

    const targetParentId = targetNode.parentId;
    let targetIndex = dropPosition === 'below'
      ? targetNode.index + 1
      : targetNode.index;

    if (
      dropPosition === 'above' &&
      draggedNode &&
      draggedNode.parentId === targetParentId &&
      Number.isInteger(draggedNode.index) &&
      draggedNode.index < targetIndex
    ) {
      targetIndex -= 1;
    }

    return { parentId: targetParentId, index: targetIndex };
  }

  function bookmarkUrlKey(url) {
    try {
      return new URL(String(url).trim()).href;
    } catch (error) {
      return null;
    }
  }

  function bookmarkDomainKey(url) {
    const domain = bookmarkDomain(url);
    return domain ? domain.trim().toLowerCase() : null;
  }

  function addBookmarksToKeyMap(bookmarks, keyFn, keyMap = new Map()) {
    bookmarks.forEach((bookmark) => {
      if (!bookmark || !bookmark.url) return;
      const key = keyFn(bookmark.url);
      if (!key) return;
      if (!keyMap.has(key)) {
        keyMap.set(key, []);
      }
      keyMap.get(key).push(bookmark);
    });
    return keyMap;
  }

  function collectDuplicateGroups(keyMap) {
    const duplicates = [];
    keyMap.forEach((items, key) => {
      if (items.length > 1) {
        duplicates.push({ url: key, items });
      }
    });
    return duplicates;
  }

  function findDuplicateBookmarks(bookmarks) {
    return collectDuplicateGroups(addBookmarksToKeyMap(bookmarks, bookmarkDomainKey));
  }

  function findDuplicateBookmarksByUrl(bookmarks) {
    return collectDuplicateGroups(addBookmarksToKeyMap(bookmarks, bookmarkUrlKey));
  }

  // Sort order for one-click folder sorting: folders first, then bookmarks,
  // each alphabetically (locale-aware, numeric-aware, case-insensitive).
  function computeSortedChildren(children) {
    const compare = (a, b) => (a.title || '').localeCompare(b.title || '', undefined, {
      numeric: true,
      sensitivity: 'base'
    });
    const folders = children.filter((child) => !child.url).sort(compare);
    const bookmarks = children.filter((child) => child.url).sort(compare);
    return [...folders, ...bookmarks];
  }

  const PERMANENT_FOLDER_IDS = ['0', '1', '2', '3'];

  // Top-most folders containing no bookmarks anywhere below them (a folder
  // whose children are all deep-empty folders counts as empty itself).
  // Permanent Chrome folders are never reported.
  function findEmptyFolders(treeNodes) {
    const empties = [];

    function isDeepEmpty(node) {
      if (node.url) return false;
      return (node.children || []).every(isDeepEmpty);
    }

    function walk(nodes, path) {
      nodes.forEach((node) => {
        if (node.url || node.unmodifiable) return;
        const nodePath = [...path, node.title];
        if (!PERMANENT_FOLDER_IDS.includes(node.id) && isDeepEmpty(node)) {
          empties.push({ id: node.id, title: node.title, path: nodePath });
          return; // topmost only: removing it removes everything below
        }
        walk(node.children || [], nodePath);
      });
    }

    const rootNode = treeNodes && treeNodes[0];
    walk(rootNode && rootNode.children ? rootNode.children : [], []);
    return empties;
  }

  // Groups of same-titled sibling folders. The lowest-index folder of each
  // group is kept; the rest are merge candidates.
  function findSameNameFolderGroups(treeNodes) {
    const groups = [];

    function walk(nodes, path) {
      const folders = nodes.filter((node) =>
        !node.url && !node.unmodifiable && !PERMANENT_FOLDER_IDS.includes(node.id));
      const byTitle = new Map();
      folders.forEach((folder) => {
        if (!byTitle.has(folder.title)) byTitle.set(folder.title, []);
        byTitle.get(folder.title).push(folder);
      });
      byTitle.forEach((sameTitle, title) => {
        if (sameTitle.length < 2) return;
        const ordered = sortNodes(sameTitle);
        groups.push({
          title,
          path: [...path, title],
          keepId: ordered[0].id,
          mergeIds: ordered.slice(1).map((folder) => folder.id)
        });
      });
      nodes.forEach((node) => {
        if (!node.url && !node.unmodifiable) {
          walk(node.children || [], [...path, node.title]);
        }
      });
    }

    const rootNode = treeNodes && treeNodes[0];
    walk(rootNode && rootNode.children ? rootNode.children : [], []);
    return groups;
  }

  // Folder styles are stored as an array of records identified by the
  // folder's dateAdded (creation time). Node ids are profile-local, but
  // Chrome bookmark sync transports creation time verbatim
  // (BookmarkSpecifics.creation_time_us), so dateAdded is identical on every
  // synced device and survives renames and moves. title/path only break ties
  // between folders created in the same millisecond (e.g. bulk imports) and
  // are refreshed ("healed") whenever a render finds them out of date.
  function sameFolderPath(a, b) {
    return Array.isArray(a) && Array.isArray(b) &&
      a.length === b.length &&
      a.every((title, i) => title === b[i]);
  }

  function commonPathSuffixLength(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return 0;
    let n = 0;
    while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) {
      n += 1;
    }
    return n;
  }

  function isDefaultFolderStyle(style) {
    return !style || (!style.color && (!style.icon || style.icon === 'default'));
  }

  function normalizeFolderStyleRecords(value) {
    return Array.isArray(value) ? value : [];
  }

  // Assign style records to the folders of one full render pass. Working on
  // the whole tree at once is what makes same-millisecond twins safe: a
  // record is matched one-to-one against every live folder sharing its
  // dateAdded, so a lone record can never be claimed by a twin of the folder
  // it belongs to. Record title/path metadata is deliberately never written
  // back outside an explicit user edit — an automatic "heal" write would
  // ping-pong between devices whose trees disagree (e.g. bookmark sync lag
  // or bookmark sync turned off while extension sync stays on).
  function assignFolderStyles(styleRecords, folders) {
    const foldersByDate = new Map();
    folders.forEach((folder) => {
      if (!foldersByDate.has(folder.dateAdded)) {
        foldersByDate.set(folder.dateAdded, []);
      }
      foldersByDate.get(folder.dateAdded).push(folder);
    });

    const recordsByDate = new Map();
    styleRecords.forEach((record) => {
      if (!recordsByDate.has(record.dateAdded)) {
        recordsByDate.set(record.dateAdded, []);
      }
      recordsByDate.get(record.dateAdded).push(record);
    });

    const byFolderId = new Map();

    recordsByDate.forEach((records, dateAdded) => {
      const dateFolders = foldersByDate.get(dateAdded) || [];
      if (dateFolders.length === 0) return;

      if (dateFolders.length === 1 && records.length === 1) {
        // Unique on both sides: dateAdded alone identifies the folder, no
        // matter how stale the record's title/path metadata is.
        byFolderId.set(dateFolders[0].id, records[0]);
        return;
      }

      // Twins: one-to-one match by exact title AND path; then by title,
      // preferring the record whose path shares the longest suffix with the
      // folder's (a renamed common ancestor changes path prefixes, but the
      // distinguishing tail — e.g. Work/News vs Home/News — survives); then
      // by exact path. Leftovers stay unassigned rather than guessed.
      let unmatchedFolders = [...dateFolders];
      let unmatchedRecords = [...records];
      [
        (folder, candidates) => candidates.findIndex(
          (record) => record.title === folder.title && sameFolderPath(record.path, folder.path)
        ),
        (folder, candidates) => {
          let bestIndex = -1;
          let bestSuffix = -1;
          candidates.forEach((record, index) => {
            if (record.title !== folder.title) return;
            const suffix = commonPathSuffixLength(record.path, folder.path);
            if (suffix > bestSuffix) {
              bestSuffix = suffix;
              bestIndex = index;
            }
          });
          return bestIndex;
        },
        (folder, candidates) => candidates.findIndex(
          (record) => sameFolderPath(record.path, folder.path)
        )
      ].forEach((selectRecord) => {
        unmatchedFolders = unmatchedFolders.filter((folder) => {
          const recordIndex = selectRecord(folder, unmatchedRecords);
          if (recordIndex === -1) return true;
          byFolderId.set(folder.id, unmatchedRecords[recordIndex]);
          unmatchedRecords.splice(recordIndex, 1);
          return false;
        });
      });
    });

    return byFolderId;
  }

  function replaceFolderStyle(styleRecords, existingRecord, { dateAdded, title, path }, style) {
    const next = styleRecords.filter((record) => {
      if (record === existingRecord) return false;
      // Also drop a record that identifies the same folder even if the
      // reference went stale (e.g. the array was replaced by a sync update
      // while the style dialog was open).
      return !(record.dateAdded === dateAdded &&
        record.title === title &&
        sameFolderPath(record.path, path));
    });
    if (!isDefaultFolderStyle(style)) {
      next.push({
        dateAdded,
        title,
        path,
        color: style.color || '',
        icon: style.icon || 'default'
      });
    }
    return next;
  }

  return {
    bookmarkDomain,
    bookmarkUrlKey,
    bookmarkDomainKey,
    addBookmarksToKeyMap,
    collectDuplicateGroups,
    sortNodes,
    computeMoveDestination,
    computeSortedChildren,
    findEmptyFolders,
    findSameNameFolderGroups,
    findDuplicateBookmarks,
    findDuplicateBookmarksByUrl,
    sameFolderPath,
    isDefaultFolderStyle,
    normalizeFolderStyleRecords,
    assignFolderStyles,
    replaceFolderStyle
  };
});
