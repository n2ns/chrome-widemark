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

  function isDefaultFolderStyle(style) {
    return !style || (!style.color && (!style.icon || style.icon === 'default'));
  }

  function normalizeFolderStyleRecords(value) {
    return Array.isArray(value) ? value : [];
  }

  function resolveFolderStyle(styleRecords, { dateAdded, title, path }) {
    const candidates = styleRecords.filter((record) => record.dateAdded === dateAdded);
    if (candidates.length === 0) {
      return { record: null, stale: false };
    }
    if (candidates.length === 1) {
      const record = candidates[0];
      return {
        record,
        stale: record.title !== title || !sameFolderPath(record.path, path)
      };
    }
    // Same-millisecond twins: disambiguate, never heal (a heal could steal
    // the record from the folder it actually belongs to).
    const record = candidates.find((r) => r.title === title) ||
      candidates.find((r) => sameFolderPath(r.path, path)) ||
      candidates[0];
    return { record, stale: false };
  }

  function upsertFolderStyle(styleRecords, { dateAdded, title, path }, style) {
    const { record } = resolveFolderStyle(styleRecords, { dateAdded, title, path });
    const next = styleRecords.filter((r) => r !== record);
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

  function healFolderStyleRecords(styleRecords, heals) {
    if (!heals || heals.size === 0) {
      return { styles: styleRecords, changed: false };
    }
    const next = styleRecords.map((record) => {
      const heal = heals.get(record);
      return heal ? { ...record, title: heal.title, path: heal.path } : record;
    });
    return { styles: next, changed: true };
  }

  return {
    bookmarkDomain,
    bookmarkUrlKey,
    bookmarkDomainKey,
    addBookmarksToKeyMap,
    collectDuplicateGroups,
    sortNodes,
    computeMoveDestination,
    findDuplicateBookmarks,
    findDuplicateBookmarksByUrl,
    sameFolderPath,
    isDefaultFolderStyle,
    normalizeFolderStyleRecords,
    resolveFolderStyle,
    upsertFolderStyle,
    healFolderStyleRecords
  };
});
