import type { BookmarkNode } from '../types.ts';
import { sortSearchResults } from './tree-logic.ts';

// Flatten all URL-bearing bookmarks and keep those whose title or URL contains
// the query, ranked by sortSearchResults (title-prefix first, then URL).
export function searchBookmarks(roots: BookmarkNode[], query: string): BookmarkNode[] {
  const needle = query.trim().toLocaleLowerCase();
  const matches: BookmarkNode[] = [];

  const walk = (nodes: BookmarkNode[]) => {
    nodes.forEach((node) => {
      if (node.url) {
        const title = (node.title || '').toLocaleLowerCase();
        if (title.includes(needle) || node.url.toLocaleLowerCase().includes(needle)) {
          matches.push(node);
        }
      } else if (node.children) {
        walk(node.children);
      }
    });
  };

  walk(roots);
  return sortSearchResults(matches, query);
}
