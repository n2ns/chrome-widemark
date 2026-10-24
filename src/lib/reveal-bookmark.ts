import { useBookmarksStore } from '../stores/bookmarks.ts';
import { useUiStore } from '../stores/ui.ts';
import { findBookmarksBarNode } from './tree-logic.ts';
import type { BookmarkNode } from '../types.ts';

// Resolve the current tree rather than keeping a search result's old ancestry.
export function revealBookmark(id: string) {
  const bookmarks = useBookmarksStore.getState();
  const findPath = (nodes: BookmarkNode[]): BookmarkNode[] | null => {
    for (const node of nodes) {
      if (node.id === id) return [node];
      const path = node.children && findPath(node.children);
      if (path) return [node, ...path];
    }
    return null;
  };
  const path = findPath(bookmarks.tree);
  if (!path) return;
  const bar = findBookmarksBarNode(bookmarks.tree);
  const root = path.find((node) => bookmarks.tree[0]?.children?.includes(node));
  bookmarks.expandFolders(path.filter((node) => !node.url).map((node) => node.id));
  useUiStore.setState({
    searchQuery: '',
    focusedNodeId: id,
    revealTargetId: id,
    // Temporarily expose a hidden root without changing the user's preference.
    revealedRootId: root && (root !== bar || root.id === id) ? root.id : null,
  });
}
