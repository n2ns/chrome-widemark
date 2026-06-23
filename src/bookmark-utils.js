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

  function findDuplicateBookmarks(bookmarks) {
    const domainMap = new Map();
    bookmarks.forEach((bookmark) => {
      if (!bookmark || !bookmark.url) return;
      const domain = bookmarkDomain(bookmark.url);
      if (!domain) return;
      const normalizedDomain = domain.trim().toLowerCase();
      if (!domainMap.has(normalizedDomain)) {
        domainMap.set(normalizedDomain, []);
      }
      domainMap.get(normalizedDomain).push(bookmark);
    });

    const duplicates = [];
    domainMap.forEach((items, domain) => {
      if (items.length > 1) {
        duplicates.push({ url: domain, items });
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
