import { assignFolderStyles } from './bookmark-utils.ts';
import { findBookmarksBarNode } from './tree-logic.ts';
import type { BookmarkNode, FolderIdentity, FolderStyleRecord } from '../types.ts';

// Collect the complete tree, retaining the existing relative paths below the
// main bookmarks bar. The bar itself still has an identity for style editing.
export function collectFolderIdentities(tree: BookmarkNode[]): FolderIdentity[] {
  const folders: FolderIdentity[] = [];
  const bar = findBookmarksBarNode(tree);

  const walk = (nodes: BookmarkNode[], parentPath: string[]) => {
    nodes.forEach((node) => {
      if (node.url) return;
      const path = [...parentPath, node.title];
      folders.push({ id: node.id, dateAdded: node.dateAdded, title: node.title, path });
      if (node.children) walk(node.children, node === bar ? [] : path);
    });
  };

  walk(tree[0]?.children ?? [], []);
  return folders;
}

// Match the complete folder tree against the persisted style records.
export function assignStylesToTree(
  tree: BookmarkNode[],
  folderStyles: FolderStyleRecord[]
): Map<string, FolderStyleRecord> {
  return assignFolderStyles(folderStyles, collectFolderIdentities(tree));
}
