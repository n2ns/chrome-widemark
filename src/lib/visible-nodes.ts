import { findBookmarksBarNode } from './tree-logic.ts';
import { sortNodes } from './bookmark-utils.ts';
import type { BookmarkNode } from '../types.ts';

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
