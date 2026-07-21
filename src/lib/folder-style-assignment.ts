import { assignFolderStyles } from './bookmark-utils.ts';
import type { BookmarkNode, FolderIdentity, FolderStyleRecord } from '../types.ts';

// Walk the rendered roots into folder identities (id + creation time + display
// path) and match them against the persisted style records. Pure: given the
// same tree and records it returns the same folderId -> style map.
export function assignStylesToTree(
  roots: BookmarkNode[],
  folderStyles: FolderStyleRecord[]
): Map<string, FolderStyleRecord> {
  const folders: FolderIdentity[] = [];

  const walk = (nodes: BookmarkNode[], parentPath: string[]) => {
    nodes.forEach((node) => {
      if (node.url) return;
      const path = [...parentPath, node.title];
      folders.push({ id: node.id, dateAdded: node.dateAdded, title: node.title, path });
      if (node.children) walk(node.children, path);
    });
  };

  walk(roots, []);
  return assignFolderStyles(folderStyles, folders);
}
