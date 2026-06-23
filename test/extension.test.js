const test = require('node:test');
const assert = require('node:assert');

const {
  bookmarkDomain,
  sortNodes,
  computeMoveDestination,
  findDuplicateBookmarks
} = require('../src/bookmark-utils.js');
const { getBookmarkIconSrc, LINK_ICON_DATA_URI } = require('../src/ui-icons.js');
const {
  findBookmarksBarNode,
  gatherFolderIds,
  determineDropPosition,
  shouldSearchBookmarks,
  sortSearchResults
} = require('../src/bookmark-tree-controller.js');
const { gatherAllBookmarks } = require('../src/duplicate-finder-controller.js');
const { THEME_CLASSES } = require('../src/settings-controller.js');

test('bookmarkDomain - extracts hostname correctly', () => {
  assert.strictEqual(bookmarkDomain('https://www.google.com/search?q=test'), 'www.google.com');
  assert.strictEqual(bookmarkDomain('http://example.com/index.html'), 'example.com');
  assert.strictEqual(bookmarkDomain('chrome://bookmarks'), null);
  assert.strictEqual(bookmarkDomain('invalid-url'), null);
});

test('sortNodes - sorts by index', () => {
  const nodes = [
    { title: 'A Bookmark', url: 'https://a.com', index: 2 },
    { title: 'B Folder', index: 0 },
    { title: 'C Bookmark', url: 'https://c.com', index: 3 },
    { title: 'D Folder', index: 1 }
  ];
  const sorted = sortNodes(nodes);
  assert.strictEqual(sorted[0].title, 'B Folder');
  assert.strictEqual(sorted[1].title, 'D Folder');
  assert.strictEqual(sorted[2].title, 'A Bookmark');
  assert.strictEqual(sorted[3].title, 'C Bookmark');
});

test('sortNodes - preserves mixed folder and bookmark index order', () => {
  const nodes = [
    { title: 'A Bookmark', url: 'https://a.com', index: 0 },
    { title: 'B Folder', index: 1 },
    { title: 'C Bookmark', url: 'https://c.com', index: 2 }
  ];
  const sorted = sortNodes(nodes);
  assert.strictEqual(sorted[0].title, 'A Bookmark');
  assert.strictEqual(sorted[1].title, 'B Folder');
  assert.strictEqual(sorted[2].title, 'C Bookmark');
});

test('computeMoveDestination - adjusts same-parent downward moves', () => {
  const dragged = { id: 'a', parentId: '1', index: 1 };
  const target = { id: 'd', parentId: '1', index: 4 };

  assert.deepStrictEqual(computeMoveDestination(dragged, target, 'above'), {
    parentId: '1',
    index: 3
  });
  assert.deepStrictEqual(computeMoveDestination(dragged, target, 'below'), {
    parentId: '1',
    index: 5
  });
});

test('computeMoveDestination - keeps same-parent below target one slot after the target', () => {
  const dragged = { id: 'a', parentId: '1', index: 1 };
  const target = { id: 'b', parentId: '1', index: 2 };

  assert.deepStrictEqual(computeMoveDestination(dragged, target, 'below'), {
    parentId: '1',
    index: 3
  });
});

test('computeMoveDestination - keeps cross-parent moves unadjusted', () => {
  const dragged = { id: 'a', parentId: '1', index: 1 };
  const target = { id: 'd', parentId: '2', index: 4 };

  assert.deepStrictEqual(computeMoveDestination(dragged, target, 'below'), {
    parentId: '2',
    index: 5
  });
});

test('computeMoveDestination - inside folder appends to target folder', () => {
  const dragged = { id: 'a', parentId: '1', index: 1 };
  const target = { id: 'folder', parentId: '1', index: 4 };

  assert.deepStrictEqual(computeMoveDestination(dragged, target, 'inside'), {
    parentId: 'folder'
  });
});

test('findDuplicateBookmarks - groups matching domains case-insensitively', () => {
  const duplicates = findDuplicateBookmarks([
    { id: '1', title: 'A', url: 'https://example.com/page' },
    { id: '2', title: 'B', url: ' https://EXAMPLE.com/page ' },
    { id: '3', title: 'C', url: 'https://other.example.com/' },
    { id: '4', title: 'Folder' }
  ]);

  assert.strictEqual(duplicates.length, 1);
  assert.strictEqual(duplicates[0].url, 'example.com');
  assert.deepStrictEqual(duplicates[0].items.map(item => item.id), ['1', '2']);
});

test('findDuplicateBookmarks - groups matching domains with different paths', () => {
  const duplicates = findDuplicateBookmarks([
    { id: '1', title: 'A', url: 'https://example.com/page1' },
    { id: '2', title: 'B', url: 'https://example.com/page2' },
    { id: '3', title: 'C', url: 'https://other.com/' }
  ]);

  assert.strictEqual(duplicates.length, 1);
  assert.strictEqual(duplicates[0].url, 'example.com');
  assert.deepStrictEqual(duplicates[0].items.map(item => item.id), ['1', '2']);
});

test('findDuplicateBookmarks - ignores unique and folder-only entries', () => {
  const duplicates = findDuplicateBookmarks([
    { id: '1', title: 'A', url: 'https://a.example.com/' },
    { id: '2', title: 'B', url: 'https://b.example.com/' },
    { id: '3', title: 'Folder' }
  ]);

  assert.deepStrictEqual(duplicates, []);
});

test('getBookmarkIconSrc - uses Chrome favicon endpoint for valid URLs', () => {
  const src = getBookmarkIconSrc({
    chromeApi: { runtime: { getURL: path => `chrome-extension://id${path}` } },
    bookmarkDomain,
    url: 'https://example.com/page?a=1'
  });

  assert.strictEqual(
    src,
    'chrome-extension://id/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2Fpage%3Fa%3D1&size=32'
  );
});

test('getBookmarkIconSrc - falls back for non-web URLs', () => {
  const src = getBookmarkIconSrc({
    chromeApi: { runtime: { getURL: path => path } },
    bookmarkDomain,
    url: 'chrome://bookmarks'
  });

  assert.strictEqual(src, LINK_ICON_DATA_URI);
});

test('gatherAllBookmarks - flattens nested bookmark trees and adds folder paths', () => {
  const bookmarks = gatherAllBookmarks([
    {
      id: 'root',
      title: 'root',
      children: [
        { id: 'folder-a', title: 'Folder A', children: [
          { id: '1', title: 'One', url: 'https://one.example/' }
        ] },
        { id: '2', title: 'Two', url: 'https://two.example/' }
      ]
    }
  ]);

  assert.deepStrictEqual(bookmarks.map(bookmark => bookmark.id), ['1', '2']);
  assert.deepStrictEqual(bookmarks.map(bookmark => bookmark.folderPath), [
    'root / Folder A',
    'root'
  ]);
});

test('findBookmarksBarNode - prefers the Chrome bookmarks bar node', () => {
  const bookmarksBar = { id: '1', title: 'Bookmarks Bar', children: [] };
  const other = { id: '2', title: 'Other Bookmarks', children: [] };

  assert.strictEqual(findBookmarksBarNode([{ id: '0', children: [other, bookmarksBar] }]), bookmarksBar);
});

test('gatherFolderIds - collects nested folder ids and skips bookmark nodes', () => {
  const folderIds = gatherFolderIds([
    {
      id: '1',
      title: 'Folder',
      children: [
        { id: '2', title: 'Bookmark', url: 'https://example.com' },
        { id: '3', title: 'Nested', children: [] }
      ]
    }
  ]);

  assert.deepStrictEqual(folderIds, ['1', '3']);
});

test('determineDropPosition - supports bookmark before and after drops', () => {
  assert.strictEqual(determineDropPosition(10, 40, false), 'above');
  assert.strictEqual(determineDropPosition(30, 40, false), 'below');
});

test('determineDropPosition - supports folder before inside and after drops', () => {
  assert.strictEqual(determineDropPosition(5, 40, true), 'above');
  assert.strictEqual(determineDropPosition(20, 40, true), 'inside');
  assert.strictEqual(determineDropPosition(35, 40, true), 'below');
});

test('shouldSearchBookmarks - skips any single ASCII character', () => {
  assert.strictEqual(shouldSearchBookmarks('a'), false);
  assert.strictEqual(shouldSearchBookmarks('Z'), false);
  assert.strictEqual(shouldSearchBookmarks('1'), false);
  assert.strictEqual(shouldSearchBookmarks(','), false);
  assert.strictEqual(shouldSearchBookmarks('.'), false);
  assert.strictEqual(shouldSearchBookmarks('+'), false);
  assert.strictEqual(shouldSearchBookmarks('-'), false);
  assert.strictEqual(shouldSearchBookmarks('='), false);
});

test('shouldSearchBookmarks - allows useful short and multi-character queries', () => {
  assert.strictEqual(shouldSearchBookmarks('旅'), true);
  assert.strictEqual(shouldSearchBookmarks('ab'), true);
  assert.strictEqual(shouldSearchBookmarks('12'), true);
  assert.strictEqual(shouldSearchBookmarks(''), false);
});

test('sortSearchResults - puts title matches before URL-only matches', () => {
  const sorted = sortSearchResults([
    { title: 'Docs', url: 'https://example.com/travel' },
    { title: 'Travel Payouts', url: 'https://app.example.com' },
    { title: 'Another Travel', url: 'https://another.example.com' }
  ], 'travel');

  assert.deepStrictEqual(sorted.map(item => item.title), [
    'Travel Payouts',
    'Another Travel',
    'Docs'
  ]);
});

test('sortSearchResults - ranks startsWith matches before contains matches', () => {
  const sorted = sortSearchResults([
    { title: 'Docs', url: 'https://travel.example.com' },
    { title: 'My Travel', url: 'https://example.com' },
    { title: 'Travel Admin', url: 'https://admin.example.com' },
    { title: 'Docs', url: 'https://example.com/travel' }
  ], 'travel');

  assert.deepStrictEqual(sorted.map(item => item.url), [
    'https://admin.example.com',
    'https://example.com',
    'https://travel.example.com',
    'https://example.com/travel'
  ]);
});

test('sortSearchResults - sorts by title then URL within the same match group', () => {
  const sorted = sortSearchResults([
    { title: 'Beta', url: 'https://b.example.com' },
    { title: 'Alpha', url: 'https://z.example.com' },
    { title: 'Alpha', url: 'https://a.example.com' }
  ], 'a');

  assert.deepStrictEqual(sorted.map(item => item.url), [
    'https://a.example.com',
    'https://z.example.com',
    'https://b.example.com'
  ]);
});

test('THEME_CLASSES - includes every selectable theme class', () => {
  assert.deepStrictEqual(THEME_CLASSES, [
    'theme-light',
    'theme-dark',
    'theme-one-dark-pro',
    'theme-dracula',
    'theme-github-dark',
    'theme-everforest',
    'theme-gruvbox'
  ]);
});
