import type { BookmarkNode } from '../types.ts';
import { sortSearchResults } from './tree-logic.ts';

export interface SearchResult extends BookmarkNode {
  folderPath: string[];
  ancestorIds: string[];
}

// Every query word must match the title or URL. Paths describe the result's
// location; they do not make unrelated descendants match a folder name.
export function searchBookmarks(roots: BookmarkNode[], query: string): SearchResult[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];
  const words = normalizedQuery.split(/\s+/);
  const matches: SearchResult[] = [];

  const walk = (nodes: BookmarkNode[], folderPath: string[], ancestorIds: string[]) => {
    nodes.forEach((node) => {
      const title = (node.title || '').toLocaleLowerCase();
      const url = (node.url || '').toLocaleLowerCase();
      if (node.id !== '0' && words.every((word) => title.includes(word) || url.includes(word))) {
        matches.push({ ...node, folderPath, ancestorIds });
      }
      if (!node.url && node.children) {
        walk(
          node.children,
          node.title ? [...folderPath, node.title] : folderPath,
          [...ancestorIds, node.id]
        );
      }
    });
  };

  walk(roots, [], []);
  return sortSearchResults(matches, query);
}
