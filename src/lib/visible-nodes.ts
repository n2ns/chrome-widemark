import { findBookmarksBarNode } from './tree-logic.ts';
import { sortNodes } from './bookmark-utils.ts';
import { searchBookmarks } from './search.ts';
import type { BookmarkNode } from '../types.ts';

export interface NavigableNode {
  focusKey: string;
  node: BookmarkNode;
}

// The nodes in the order their rows appear on screen, respecting folder
// expansion — used for arrow-key navigation. Mirrors BookmarkTree's render:
// sorted bookmarks-bar children first, then the other top-level folders.
export function flattenVisibleNodes(
  tree: BookmarkNode[],
  showOtherBookmarks: boolean,
  expandedFolderIds: Set<string>
): BookmarkNode[] {
  const bar = findBookmarksBarNode(tree);
  const barChildren = bar?.children ?? [];
  const topLevel = tree[0]?.children ?? [];
  const otherRoots = showOtherBookmarks ? topLevel.filter((n) => n !== bar && !n.url) : [];

  const out: BookmarkNode[] = [];
  const walk = (nodes: BookmarkNode[], sort: boolean) => {
    (sort ? sortNodes(nodes) : nodes).forEach((node) => {
      out.push(node);
      if (!node.url && node.children && expandedFolderIds.has(node.id)) {
        walk(node.children, true);
      }
    });
  };
  walk(barChildren, true);
  walk(otherRoots, false);
  return out;
}

export function getNavigableNodes({
  tree,
  recent,
  showOtherBookmarks,
  showRecent,
  recentExpanded,
  expandedFolderIds,
  searchQuery,
  searchActive,
}: {
  tree: BookmarkNode[];
  recent: BookmarkNode[];
  showOtherBookmarks: boolean;
  showRecent: boolean;
  recentExpanded: boolean;
  expandedFolderIds: Set<string>;
  searchQuery: string;
  searchActive: boolean;
}): NavigableNode[] {
  if (searchActive) {
    return searchBookmarks(tree, searchQuery).map((node) => ({ focusKey: `search:${node.id}`, node }));
  }

  const recentNodes = showRecent && recentExpanded
    ? recent.map((node) => ({ focusKey: `recent:${node.id}`, node }))
    : [];
  const treeNodes = flattenVisibleNodes(tree, showOtherBookmarks, expandedFolderIds)
    .map((node) => ({ focusKey: node.id, node }));
  return [...recentNodes, ...treeNodes];
}
