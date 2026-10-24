import { describe, expect, it } from 'vitest';
import { searchBookmarks } from './search.ts';
import type { BookmarkNode } from '../types.ts';

const tree: BookmarkNode[] = [{
  id: '0', syncing: false, title: '', children: [{
    id: '1', syncing: false, title: 'Bookmarks Bar', children: [{
      id: 'work', syncing: false, title: 'Research 工作', children: [
        { id: 'guide', syncing: false, title: 'React TypeScript Guide', url: 'https://react.dev/learn' },
        { id: 'zh', syncing: false, title: '中文 开发指南', url: 'https://example.org/zh' },
        { id: 'first', syncing: false, title: 'Docs', url: 'https://docs.example.com/' },
      ],
    }, {
      id: 'personal', syncing: false, title: 'Personal', children: [
        { id: 'second', syncing: false, title: 'Docs', url: 'https://docs.example.com/' },
      ],
    }],
  }],
}];

describe('searchBookmarks', () => {
  it('matches all whitespace-separated words, ignoring case and word order', () => {
    expect(searchBookmarks(tree, '  GUIDE\tReAcT\n').map((node) => node.id)).toEqual(['guide']);
    expect(searchBookmarks(tree, 'react missing')).toEqual([]);
  });

  it('allows words to match across title and URL', () => {
    expect(searchBookmarks(tree, 'typescript react.dev').map((node) => node.id)).toEqual(['guide']);
  });

  it('supports Chinese single-character and multiple-word queries', () => {
    expect(searchBookmarks(tree, '中').map((node) => node.id)).toEqual(['zh']);
    expect(searchBookmarks(tree, '指南 中文').map((node) => node.id)).toEqual(['zh']);
  });

  it('finds folders themselves without matching their unrelated descendants', () => {
    const [folder] = searchBookmarks(tree, 'research 工作');
    expect(folder?.id).toBe('work');
    expect(folder?.url).toBeUndefined();
    expect(folder?.folderPath).toEqual(['Bookmarks Bar']);
    expect(folder?.ancestorIds).toEqual(['0', '1']);
    expect(searchBookmarks(tree, 'research').map((node) => node.id)).toEqual(['work']);
  });

  it('includes named permanent folders but excludes the virtual root', () => {
    expect(searchBookmarks(tree, 'bookmarks bar').map((node) => node.id)).toEqual(['1']);
    expect(searchBookmarks([{ id: '0', syncing: false, title: 'Virtual Root' }], 'virtual')).toEqual([]);
  });

  it('distinguishes same-named results by their ancestor paths and IDs', () => {
    const results = searchBookmarks(tree, 'docs');
    expect(results.map(({ id, folderPath, ancestorIds }) => ({ id, folderPath, ancestorIds }))).toEqual([
      { id: 'first', folderPath: ['Bookmarks Bar', 'Research 工作'], ancestorIds: ['0', '1', 'work'] },
      { id: 'second', folderPath: ['Bookmarks Bar', 'Personal'], ancestorIds: ['0', '1', 'personal'] },
    ]);
  });

  it('returns no results for empty or whitespace-only queries', () => {
    expect(searchBookmarks(tree, '')).toEqual([]);
    expect(searchBookmarks(tree, ' \t\n ')).toEqual([]);
  });

  it('ranks title phrases and title word matches ahead of URL and mixed matches without mutating input', () => {
    const nodes: BookmarkNode[] = [
      { id: 'mixed', syncing: false, title: 'A React reference', url: 'https://example.com/guide' },
      { id: 'url', syncing: false, title: 'A reference', url: 'https://example.com/react/guide' },
      { id: 'words', syncing: false, title: 'A React TypeScript Guide', url: 'https://example.com/' },
      { id: 'phrase', syncing: false, title: 'The React Guide', url: 'https://example.com/' },
      { id: 'prefix', syncing: false, title: 'React Guide for beginners', url: 'https://example.com/' },
    ];
    const before = structuredClone(nodes);
    expect(searchBookmarks(nodes, 'react guide').map((node) => node.id)).toEqual(['prefix', 'phrase', 'words', 'url', 'mixed']);
    expect(nodes).toEqual(before);
    expect(nodes.every((node) => !Object.hasOwn(node, 'folderPath'))).toBe(true);
  });
});
