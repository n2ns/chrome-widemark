import test from 'node:test';
import assert from 'node:assert';

import {
  bookmarkDomain,
  bookmarkUrlKey,
  bookmarkDomainKey,
  sortNodes,
  computeMoveDestination,
  findDuplicateBookmarks,
  findDuplicateBookmarksByUrl,
  normalizeFolderStyleRecords,
  assignFolderStyles,
  replaceFolderStyle,
  computeSortedChildren,
  findEmptyFolders,
  findSameNameFolderGroups,
  addBookmarksToKeyMap,
  collectDuplicateGroups
} from '../src/lib/bookmark-utils.ts';
import { getBookmarkIconSrc, LINK_ICON_DATA_URI } from '../src/lib/ui-icons.ts';
import {
  findBookmarksBarNode,
  gatherFolderIds,
  determineDropPosition,
  extractLinkInfo,
  shouldSearchBookmarks,
  sortSearchResults
} from '../src/lib/tree-logic.ts';
import { gatherAllBookmarks, runChunkedDuplicateScan } from '../src/lib/duplicate-scan.ts';
import { THEME_CLASSES } from '../src/lib/theme.ts';

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

test('assignFolderStyles - follows a uniquely identified folder across rename and move', () => {
  const record = { dateAdded: 100, title: 'Dev', path: ['Dev'], color: 'red', icon: 'code' };
  const folder = { id: '10', dateAdded: 100, title: 'Engineering', path: ['Work', 'Engineering'] };

  const byFolderId = assignFolderStyles([record], [folder]);

  assert.strictEqual(byFolderId.get('10'), record);
});

test('assignFolderStyles - a lone record is never claimed by a same-millisecond twin', () => {
  // Regression: folders A and B share dateAdded, only B is styled. A must
  // not receive B's record.
  const recordB = { dateAdded: 100, title: 'B', path: ['Import', 'B'], color: 'blue', icon: 'heart' };
  const folders = [
    { id: 'a', dateAdded: 100, title: 'A', path: ['Import', 'A'] },
    { id: 'b', dateAdded: 100, title: 'B', path: ['Import', 'B'] }
  ];

  const byFolderId = assignFolderStyles([recordB], folders);

  assert.strictEqual(byFolderId.get('a'), undefined);
  assert.strictEqual(byFolderId.get('b'), recordB);
});

test('assignFolderStyles - matches same-millisecond twins one-to-one by title then path', () => {
  const recordA = { dateAdded: 100, title: 'Old A', path: ['Import', 'A'], color: 'red', icon: 'star' };
  const recordB = { dateAdded: 100, title: 'B', path: ['Import', 'B'], color: 'blue', icon: 'heart' };
  const folders = [
    { id: 'a', dateAdded: 100, title: 'A', path: ['Import', 'A'] },
    { id: 'b', dateAdded: 100, title: 'B', path: ['Import', 'B'] }
  ];

  const byFolderId = assignFolderStyles([recordA, recordB], folders);

  assert.strictEqual(byFolderId.get('b'), recordB);
  assert.strictEqual(byFolderId.get('a'), recordA);
});

test('assignFolderStyles - same-titled twins in different parents keep their own styles', () => {
  // Regression: Work/News and Home/News share dateAdded and title; matching
  // must compare paths first so the styles do not swap.
  const homeRecord = { dateAdded: 100, title: 'News', path: ['Home', 'News'], color: 'red', icon: 'star' };
  const workRecord = { dateAdded: 100, title: 'News', path: ['Work', 'News'], color: 'blue', icon: 'heart' };
  const folders = [
    { id: 'work', dateAdded: 100, title: 'News', path: ['Work', 'News'] },
    { id: 'home', dateAdded: 100, title: 'News', path: ['Home', 'News'] }
  ];

  const byFolderId = assignFolderStyles([homeRecord, workRecord], folders);

  assert.strictEqual(byFolderId.get('work'), workRecord);
  assert.strictEqual(byFolderId.get('home'), homeRecord);
});

test('assignFolderStyles - same-titled twins survive a renamed common ancestor via path suffix', () => {
  // Regression: ancestor "Stuff" was renamed to "Things" after both twins
  // were styled, so no record path matches exactly. Record order is the
  // reverse of render order; the longest-common-suffix rule must still pair
  // Work/News with the Work record.
  const homeRecord = { dateAdded: 100, title: 'News', path: ['Stuff', 'Home', 'News'], color: 'red', icon: 'star' };
  const workRecord = { dateAdded: 100, title: 'News', path: ['Stuff', 'Work', 'News'], color: 'blue', icon: 'heart' };
  const folders = [
    { id: 'work', dateAdded: 100, title: 'News', path: ['Things', 'Work', 'News'] },
    { id: 'home', dateAdded: 100, title: 'News', path: ['Things', 'Home', 'News'] }
  ];

  const byFolderId = assignFolderStyles([homeRecord, workRecord], folders);

  assert.strictEqual(byFolderId.get('work'), workRecord);
  assert.strictEqual(byFolderId.get('home'), homeRecord);
});

test('assignFolderStyles - ignores records whose folder is absent locally', () => {
  const orphan = { dateAdded: 300, title: 'Remote', path: ['Remote'], color: 'red', icon: 'star' };
  const byFolderId = assignFolderStyles([orphan], [
    { id: '1', dateAdded: 100, title: 'Dev', path: ['Dev'] }
  ]);

  assert.strictEqual(byFolderId.size, 0);
});

test('replaceFolderStyle - replaces exactly the assigned record and drops default styles', () => {
  const identity = { dateAdded: 100, title: 'Dev', path: ['Dev'] };
  const other = { dateAdded: 100, title: 'Twin', path: ['Twin'], color: 'blue', icon: 'heart' };

  const added = replaceFolderStyle([other], null, identity, { color: 'red', icon: 'code' });
  assert.deepStrictEqual(added, [
    other,
    { dateAdded: 100, title: 'Dev', path: ['Dev'], color: 'red', icon: 'code' }
  ]);

  const replaced = replaceFolderStyle(added, added[1], identity, { color: 'green', icon: 'star' });
  assert.strictEqual(replaced.length, 2);
  assert.strictEqual(replaced[0], other);
  assert.strictEqual(replaced[1].color, 'green');

  const cleared = replaceFolderStyle(replaced, replaced[1], identity, { color: '', icon: 'default' });
  assert.deepStrictEqual(cleared, [other]);
});

test('replaceFolderStyle - also drops a stale-reference record identifying the same folder', () => {
  const identity = { dateAdded: 100, title: 'Dev', path: ['Dev'] };
  const staleCopy = { dateAdded: 100, title: 'Dev', path: ['Dev'], color: 'red', icon: 'code' };

  const next = replaceFolderStyle([staleCopy], null, identity, { color: 'blue', icon: 'star' });

  assert.deepStrictEqual(next, [
    { dateAdded: 100, title: 'Dev', path: ['Dev'], color: 'blue', icon: 'star' }
  ]);
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

test('runChunkedDuplicateScan - stops early when shouldContinue reports superseded', async () => {
  const bookmarks = [];
  for (let i = 0; i < 450; i++) {
    bookmarks.push({ id: String(i), title: `B${i}`, url: `https://example.com/p${i}` });
  }

  let chunks = 0;
  let doneCalled = false;
  runChunkedDuplicateScan({
    bookmarks,
    keyFn: bookmarkUrlKey,
    addBookmarksToKeyMap,
    collectDuplicateGroups,
    shouldContinue: () => chunks < 1,
    onProgress: () => {
      chunks += 1;
    },
    onDone: () => {
      doneCalled = true;
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.strictEqual(chunks, 1);
  assert.strictEqual(doneCalled, false);
});

test('bookmarkDomainKey - lowercases hostnames and rejects non-web URLs', () => {
  assert.strictEqual(bookmarkDomainKey('https://WWW.Example.com/page'), 'www.example.com');
  assert.strictEqual(bookmarkDomainKey('chrome://bookmarks'), null);
});

test('computeSortedChildren - folders first, then bookmarks, alphabetically and numerically', () => {
  const sorted = computeSortedChildren([
    { id: '1', title: 'zeta', url: 'https://z.example' },
    { id: '2', title: 'Alpha Folder' },
    { id: '3', title: 'alpha', url: 'https://a.example' },
    { id: '4', title: 'item 10', url: 'https://ten.example' },
    { id: '5', title: 'item 2', url: 'https://two.example' },
    { id: '6', title: 'beta folder' }
  ]);

  assert.deepStrictEqual(sorted.map(node => node.id), ['2', '6', '3', '5', '4', '1']);
});

test('findEmptyFolders - reports topmost deep-empty folders and skips permanent roots', () => {
  const tree = [{
    id: '0',
    children: [{
      id: '1',
      title: 'Bookmarks Bar',
      children: [
        { id: '10', title: 'Full', children: [{ id: '11', title: 'A', url: 'https://a.example' }] },
        {
          id: '20',
          title: 'Hollow',
          children: [{ id: '21', title: 'Inner', children: [] }]
        },
        { id: '30', title: 'Bare', children: [] }
      ]
    }, {
      id: '2',
      title: 'Other Bookmarks',
      children: []
    }]
  }];

  const empties = findEmptyFolders(tree);

  assert.deepStrictEqual(empties.map(folder => folder.id), ['20', '30']);
  assert.deepStrictEqual(empties[0].path, ['Bookmarks Bar', 'Hollow']);
});

test('findEmptyFolders and findSameNameFolderGroups - skip policy-managed subtrees', () => {
  const tree = [{
    id: '0',
    children: [{
      id: '1',
      title: 'Bookmarks Bar',
      children: [
        { id: '90', title: 'Managed', unmodifiable: 'managed', children: [] },
        {
          id: '91',
          title: 'Managed Parent',
          unmodifiable: 'managed',
          children: [
            { id: '92', title: 'Dup', index: 0, children: [] },
            { id: '93', title: 'Dup', index: 1, children: [] }
          ]
        },
        { id: '94', title: 'User Empty', children: [] }
      ]
    }]
  }];

  assert.deepStrictEqual(findEmptyFolders(tree).map(folder => folder.id), ['94']);
  assert.deepStrictEqual(findSameNameFolderGroups(tree), []);
});

test('findSameNameFolderGroups - groups same-titled siblings only, keeping the lowest index', () => {
  const tree = [{
    id: '0',
    children: [{
      id: '1',
      title: 'Bookmarks Bar',
      children: [
        { id: '10', title: 'Dev', index: 0, children: [] },
        { id: '11', title: 'Dev', index: 2, children: [] },
        { id: '12', title: 'Dev', index: 1, children: [] },
        {
          id: '20',
          title: 'Nested',
          index: 3,
          children: [
            { id: '21', title: 'Dev', index: 0, children: [] }
          ]
        }
      ]
    }]
  }];

  const groups = findSameNameFolderGroups(tree);

  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].keepId, '10');
  assert.deepStrictEqual(groups[0].mergeIds, ['12', '11']);
  assert.deepStrictEqual(groups[0].path, ['Bookmarks Bar', 'Dev']);
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
