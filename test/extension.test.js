const test = require('node:test');
const assert = require('node:assert');

const {
  bookmarkDomain,
  bookmarkUrlKey,
  bookmarkDomainKey,
  sortNodes,
  computeMoveDestination,
  findDuplicateBookmarks,
  findDuplicateBookmarksByUrl,
  normalizeFolderStyleRecords,
  resolveFolderStyle,
  upsertFolderStyle,
  healFolderStyleRecords
} = require('../src/bookmark-utils.js');
const { getBookmarkIconSrc, LINK_ICON_DATA_URI } = require('../src/ui-icons.js');
const {
  findBookmarksBarNode,
  gatherFolderIds,
  determineDropPosition,
  extractLinkInfo,
  shouldSearchBookmarks,
  sortSearchResults
} = require('../src/bookmark-tree-controller.js');
const { gatherAllBookmarks, runChunkedDuplicateScan } = require('../src/duplicate-finder-controller.js');
const { addBookmarksToKeyMap, collectDuplicateGroups } = require('../src/bookmark-utils.js');
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

test('bookmarkUrlKey - normalizes host case and whitespace, rejects invalid URLs', () => {
  assert.strictEqual(bookmarkUrlKey(' https://EXAMPLE.com/Page?a=1 '), 'https://example.com/Page?a=1');
  assert.strictEqual(bookmarkUrlKey('chrome://bookmarks'), 'chrome://bookmarks');
  assert.strictEqual(bookmarkUrlKey('not a url'), null);
});

test('findDuplicateBookmarksByUrl - groups only exact URL matches', () => {
  const duplicates = findDuplicateBookmarksByUrl([
    { id: '1', title: 'A', url: 'https://example.com/page' },
    { id: '2', title: 'B', url: ' https://EXAMPLE.com/page ' },
    { id: '3', title: 'C', url: 'https://example.com/other' },
    { id: '4', title: 'Folder' }
  ]);

  assert.strictEqual(duplicates.length, 1);
  assert.strictEqual(duplicates[0].url, 'https://example.com/page');
  assert.deepStrictEqual(duplicates[0].items.map(item => item.id), ['1', '2']);
});

test('findDuplicateBookmarksByUrl - keeps different paths and queries separate', () => {
  const duplicates = findDuplicateBookmarksByUrl([
    { id: '1', title: 'A', url: 'https://example.com/page?a=1' },
    { id: '2', title: 'B', url: 'https://example.com/page?a=2' },
    { id: '3', title: 'C', url: 'https://example.com/page' }
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

function createDataTransfer(data) {
  return {
    types: Object.keys(data),
    getData: type => data[type] || ''
  };
}

test('extractLinkInfo - reads the first URL from uri-list and uses anchor text as title', () => {
  const originalDOMParser = global.DOMParser;
  global.DOMParser = class FakeDOMParser {
    parseFromString(html) {
      const match = html.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
      const text = match ? match[1].replace(/<[^>]+>/g, '').trim() : '';
      return {
        querySelector: selector => (selector === 'a' && text ? { textContent: text, innerText: text } : null)
      };
    }
  };

  try {
    assert.deepStrictEqual(extractLinkInfo(createDataTransfer({
      'text/uri-list': '# dragged link\r\nhttps://example.com/docs\r\nhttps://ignored.example/',
      'text/html': '<a href="https://example.com/docs"><strong>Example Docs</strong></a>'
    })), {
      url: 'https://example.com/docs',
      title: 'Example Docs'
    });
  } finally {
    global.DOMParser = originalDOMParser;
  }
});

test('extractLinkInfo - falls back to a compact URL title for plain URLs', () => {
  assert.deepStrictEqual(extractLinkInfo(createDataTransfer({
    'text/plain': ' https://example.com/path/page?utm=1 \nhttps://ignored.example/'
  })), {
    url: 'https://example.com/path/page?utm=1',
    title: 'example.com/path/page'
  });
});

test('extractLinkInfo - falls back when dragged anchor text is blank', () => {
  const originalDOMParser = global.DOMParser;
  global.DOMParser = class FakeDOMParser {
    parseFromString() {
      return {
        querySelector: () => ({ textContent: '   ', innerText: '   ' })
      };
    }
  };

  try {
    assert.deepStrictEqual(extractLinkInfo(createDataTransfer({
      'text/uri-list': 'https://example.com/fallback',
      'text/html': '<a href="https://example.com/fallback">   </a>'
    })), {
      url: 'https://example.com/fallback',
      title: 'example.com/fallback'
    });
  } finally {
    global.DOMParser = originalDOMParser;
  }
});

test('extractLinkInfo - rejects non-web and invalid dropped URLs', () => {
  assert.strictEqual(extractLinkInfo(createDataTransfer({
    'text/uri-list': 'javascript:alert(1)'
  })), null);
  assert.strictEqual(extractLinkInfo(createDataTransfer({
    'text/plain': 'not a url'
  })), null);
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

test('resolveFolderStyle - identifies folders by dateAdded across rename and move', () => {
  const records = [
    { dateAdded: 100, title: 'Dev', path: ['Dev'], color: 'red', icon: 'code' }
  ];

  const renamedAndMoved = resolveFolderStyle(records, {
    dateAdded: 100,
    title: 'Engineering',
    path: ['Work', 'Engineering']
  });
  assert.strictEqual(renamedAndMoved.record, records[0]);
  assert.strictEqual(renamedAndMoved.stale, true);

  const unrelated = resolveFolderStyle(records, { dateAdded: 200, title: 'Dev', path: ['Dev'] });
  assert.strictEqual(unrelated.record, null);
});

test('resolveFolderStyle - breaks same-millisecond ties by title then path, never heals', () => {
  const twinA = { dateAdded: 100, title: 'A', path: ['Import', 'A'], color: 'red', icon: 'star' };
  const twinB = { dateAdded: 100, title: 'B', path: ['Import', 'B'], color: 'blue', icon: 'heart' };
  const records = [twinA, twinB];

  const byTitle = resolveFolderStyle(records, { dateAdded: 100, title: 'B', path: ['Elsewhere', 'B'] });
  assert.strictEqual(byTitle.record, twinB);
  assert.strictEqual(byTitle.stale, false);

  const byPath = resolveFolderStyle(records, { dateAdded: 100, title: 'Renamed', path: ['Import', 'A'] });
  assert.strictEqual(byPath.record, twinA);
  assert.strictEqual(byPath.stale, false);
});

test('upsertFolderStyle - replaces the matching record and drops default styles', () => {
  const identity = { dateAdded: 100, title: 'Dev', path: ['Dev'] };
  const records = upsertFolderStyle([], identity, { color: 'red', icon: 'code' });
  assert.deepStrictEqual(records, [
    { dateAdded: 100, title: 'Dev', path: ['Dev'], color: 'red', icon: 'code' }
  ]);

  const replaced = upsertFolderStyle(records, identity, { color: 'blue', icon: 'star' });
  assert.strictEqual(replaced.length, 1);
  assert.strictEqual(replaced[0].color, 'blue');

  const cleared = upsertFolderStyle(replaced, identity, { color: '', icon: 'default' });
  assert.deepStrictEqual(cleared, []);
});

test('healFolderStyleRecords - refreshes stale title and path metadata', () => {
  const record = { dateAdded: 100, title: 'Dev', path: ['Dev'], color: 'red', icon: 'code' };
  const untouched = { dateAdded: 200, title: 'Docs', path: ['Docs'], color: 'green', icon: 'document' };
  const heals = new Map([[record, { title: 'Engineering', path: ['Work', 'Engineering'] }]]);

  const { styles, changed } = healFolderStyleRecords([record, untouched], heals);

  assert.strictEqual(changed, true);
  assert.deepStrictEqual(styles[0], {
    dateAdded: 100,
    title: 'Engineering',
    path: ['Work', 'Engineering'],
    color: 'red',
    icon: 'code'
  });
  assert.strictEqual(styles[1], untouched);

  const noHeal = healFolderStyleRecords([record], new Map());
  assert.strictEqual(noHeal.changed, false);
});

test('normalizeFolderStyleRecords - tolerates missing or malformed stored values', () => {
  assert.deepStrictEqual(normalizeFolderStyleRecords(undefined), []);
  assert.deepStrictEqual(normalizeFolderStyleRecords({ legacy: true }), []);
  const records = [{ dateAdded: 1, title: 'A', path: ['A'], color: '', icon: 'star' }];
  assert.strictEqual(normalizeFolderStyleRecords(records), records);
});

test('runChunkedDuplicateScan - reports progress and matches the synchronous result', async () => {
  const bookmarks = [];
  for (let i = 0; i < 450; i++) {
    bookmarks.push({ id: String(i), title: `B${i}`, url: `https://example.com/page${i % 100}` });
  }

  const progress = [];
  const duplicates = await new Promise((resolve) => {
    runChunkedDuplicateScan({
      bookmarks,
      keyFn: bookmarkUrlKey,
      addBookmarksToKeyMap,
      collectDuplicateGroups,
      onProgress: (checked, total) => progress.push([checked, total]),
      onDone: resolve
    });
  });

  assert.deepStrictEqual(progress, [[200, 450], [400, 450], [450, 450]]);
  assert.deepStrictEqual(duplicates, findDuplicateBookmarksByUrl(bookmarks));
});

test('bookmarkDomainKey - lowercases hostnames and rejects non-web URLs', () => {
  assert.strictEqual(bookmarkDomainKey('https://WWW.Example.com/page'), 'www.example.com');
  assert.strictEqual(bookmarkDomainKey('chrome://bookmarks'), null);
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
