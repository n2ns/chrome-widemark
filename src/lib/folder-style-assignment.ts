import { assignFolderStyles } from './bookmark-utils.ts';
import type { BookmarkNode, FolderIdentity, FolderStyleRecord } from '../types.ts';

// Walk the rendered roots into folder identities (id + creation time + display
// path). Pure: same tree in, same identities out.
export function collectFolderIdentities(roots: BookmarkNode[]): FolderIdentity[] {
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
  return folders;
}

// Match the rendered folders against the persisted style records.
export function assignStylesToTree(
  roots: BookmarkNode[],
  folderStyles: FolderStyleRecord[]
): Map<string, FolderStyleRecord> {
  return assignFolderStyles(folderStyles, collectFolderIdentities(roots));
}
