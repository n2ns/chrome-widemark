// Framework-agnostic bookmark-tree logic: locating the bookmarks bar, drop
// position math, dropped-link parsing, and search ranking. No DOM rendering.
import type { BookmarkNode, DropPosition } from '../types.ts';

export interface LinkInfo {
  url: string;
  title: string;
}

// The folders whose styles are computed and which the tree renders: the
// bookmarks-bar children plus (optionally) the other top-level folders.
export function getVisibleRoots(tree: BookmarkNode[], showOtherBookmarks: boolean): BookmarkNode[] {
  const bar = findBookmarksBarNode(tree);
  const barChildren = bar?.children ?? [];
  const topLevel = tree[0]?.children ?? [];
  const otherRoots = showOtherBookmarks ? topLevel.filter((node) => node !== bar && !node.url) : [];
  return [...barChildren, ...otherRoots];
}

export function findBookmarksBarNode(nodes: BookmarkNode[]) {
  const rootNode = nodes[0];
  if (!rootNode || !rootNode.children) {
    return null;
  }
  return rootNode.children.find(child => child.id === '1') ||
    rootNode.children.find(child => child.folderType === 'bookmarks-bar') ||
    rootNode.children[0] ||
    null;
}

export function gatherFolderIds(nodes: BookmarkNode[], folderIds: string[] = []) {
  nodes.forEach(node => {
    if (!node.url) {
      folderIds.push(node.id);
      if (node.children) {
        gatherFolderIds(node.children, folderIds);
      }
    }
  });
  return folderIds;
}

export function determineDropPosition(y: number, height: number, isFolder: boolean): DropPosition {
  if (isFolder) {
    if (y < height * 0.25) return 'above';
    if (y > height * 0.75) return 'below';
    return 'inside';
  }
  return y < height / 2 ? 'above' : 'below';
}

export function hasTransferType(dataTransfer: DataTransfer, type: string) {
  return Array.prototype.includes.call(dataTransfer.types || [], type);
}

function firstUriListUrl(uriList: string) {
  return uriList
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line && !line.startsWith('#')) || '';
}

function firstPlainTextUrl(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .find(Boolean) || '';
}

export function normalizeDroppedUrl(dataTransfer: DataTransfer) {
  const uriListUrl = firstUriListUrl(dataTransfer.getData('text/uri-list') || '');
  const url = uriListUrl || firstPlainTextUrl(dataTransfer.getData('text/plain') || '');
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return null;
    }
    return parsedUrl.href;
  } catch (_) {
    return null;
  }
}

export function extractLinkInfo(dataTransfer: DataTransfer): LinkInfo | null {
  const url = normalizeDroppedUrl(dataTransfer);
  if (!url) return null;

  let title = '';
  const html = dataTransfer.getData('text/html');
  if (html && typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const anchor = doc.querySelector('a');
    if (anchor) {
      title = (anchor.textContent || anchor.innerText || '').trim();
    }
  }
  if (!title) {
    try {
      const parsedUrl = new URL(url);
      title = parsedUrl.hostname + (parsedUrl.pathname !== '/' ? parsedUrl.pathname : '');
    } catch (_) {
      title = url;
    }
  }
  return { url, title: title.trim() };
}

export function shouldSearchBookmarks(query: string) {
  const trimmed = query.trim();
  return trimmed.length > 0 && !(trimmed.length === 1 && /^[\x00-\x7F]$/.test(trimmed));
}

function normalizeSearchText(value: string | null | undefined) {
  return (value || '').trim().toLocaleLowerCase();
}

function compareText(a: string | null | undefined, b: string | null | undefined) {
  return normalizeSearchText(a).localeCompare(normalizeSearchText(b), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

function normalizeUrlForSearchRank(url: string | null | undefined) {
  return normalizeSearchText(url).replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^www\./, '');
}

export function sortSearchResults<T extends BookmarkNode>(results: T[], query: string): T[] {
  const normalizedQuery = normalizeSearchText(query).replace(/\s+/g, ' ');
  const words = normalizedQuery.split(' ');

  function matchRank(item: BookmarkNode) {
    const title = normalizeSearchText(item.title);
    const url = normalizeSearchText(item.url);
    const rankedUrl = normalizeUrlForSearchRank(item.url);
    if (title.startsWith(normalizedQuery)) return 0;
    if (title.includes(normalizedQuery)) return 1;
    if (words.every((word) => title.includes(word))) return 2;
    if (rankedUrl.startsWith(normalizedQuery)) return 3;
    if (url.includes(normalizedQuery)) return 4;
    if (words.every((word) => url.includes(word))) return 5;
    return 6;
  }

  return [...results].sort((a, b) => {
    const rankDiff = matchRank(a) - matchRank(b);
    if (rankDiff !== 0) {
      return rankDiff;
    }

    return compareText(a.title || a.url, b.title || b.url) || compareText(a.url, b.url);
  });
}
