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
      const aIsFolder = !a.url;
      const bIsFolder = !b.url;
      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;
      return 0;
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

  function findDuplicateBookmarks(bookmarks) {
    const urlMap = new Map();
    bookmarks.forEach((bookmark) => {
      if (!bookmark || !bookmark.url) return;
      const normalizedUrl = bookmark.url.trim().toLowerCase();
      if (!urlMap.has(normalizedUrl)) {
        urlMap.set(normalizedUrl, []);
      }
      urlMap.get(normalizedUrl).push(bookmark);
    });

    const duplicates = [];
    urlMap.forEach((items) => {
      if (items.length > 1) {
        duplicates.push({ url: items[0].url, items });
      }
    });
    return duplicates;
  }

  return {
    bookmarkDomain,
    sortNodes,
    computeMoveDestination,
    findDuplicateBookmarks
  };
});
