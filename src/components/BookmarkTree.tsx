import { useState } from 'react';
import { useBookmarksStore } from '../stores/bookmarks.ts';
import { useSettingsStore } from '../stores/settings.ts';
import { useFolderStylesStore } from '../stores/folderStyles.ts';
import { useUiStore } from '../stores/ui.ts';
import { useContextMenuStore } from '../stores/contextMenu.ts';
import { useNodeDrag } from '../hooks/useNodeDrag.ts';
import { sortNodes } from '../lib/bookmark-utils.ts';
import { findBookmarksBarNode, shouldSearchBookmarks } from '../lib/tree-logic.ts';
import { assignStylesToTree } from '../lib/folder-style-assignment.ts';
import { searchBookmarks } from '../lib/search.ts';
import { getFolderSvgIcon } from '../lib/ui-icons.ts';
import { BookmarkRow } from './BookmarkRow.tsx';
import type { BookmarkNode, FolderStyleRecord } from '../types.ts';

type StyleMap = Map<string, FolderStyleRecord>;

function FolderRow({ node, styleMap }: { node: BookmarkNode; styleMap: StyleMap }) {
  const expanded = useBookmarksStore((s) => s.expandedFolderIds.has(node.id));
  const setExpanded = useBookmarksStore((s) => s.setExpanded);
  const focused = useUiStore((s) => s.focusedNodeId === node.id);
  const drag = useNodeDrag(node);
  const style = styleMap.get(node.id);
  const iconHtml = getFolderSvgIcon(style?.icon && style.icon !== 'default' ? style.icon : 'default');

  return (
    <li>
      <div
        className={`tree-node${expanded ? ' expanded' : ''}${drag.dragClass}${focused ? ' kb-focus' : ''}`}
        data-node-id={node.id}
        draggable={drag.draggable}
        {...drag.handlers}
        onClick={() => setExpanded(node.id, !expanded)}
        onContextMenu={(event) => {
          event.preventDefault();
          useContextMenuStore.getState().open(node, event.clientX, event.clientY);
        }}
      >
        <span
          className="node-icon folder-icon"
          style={style?.color ? { color: style.color } : undefined}
          dangerouslySetInnerHTML={{ __html: iconHtml }}
        />
        <span className="node-title">{node.title}</span>
      </div>
      <ul className={`nested-tree folder-children${expanded ? ' visible' : ''}`}>
        {sortNodes(node.children ?? []).map((child) => (
          <TreeItem key={child.id} node={child} styleMap={styleMap} />
        ))}
      </ul>
    </li>
  );
}

function TreeItem({ node, styleMap }: { node: BookmarkNode; styleMap: StyleMap }) {
  if (node.url) {
    return (
      <li>
        <BookmarkRow node={node} />
      </li>
    );
  }
  return <FolderRow node={node} styleMap={styleMap} />;
}

function RecentSection({ nodes }: { nodes: BookmarkNode[] }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <li>
      <div
        className={`tree-node recent-section-header${expanded ? ' expanded' : ''}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="node-icon folder-icon" dangerouslySetInnerHTML={{ __html: getFolderSvgIcon('default') }} />
        <span className="node-title">Recently Added</span>
      </div>
      <ul className={`nested-tree folder-children${expanded ? ' visible' : ''}`}>
        {nodes.map((node) => (
          <li key={node.id}>
            <BookmarkRow node={node} />
          </li>
        ))}
      </ul>
    </li>
  );
}

export function BookmarkTree() {
  const tree = useBookmarksStore((s) => s.tree);
  const recent = useBookmarksStore((s) => s.recent);
  const loaded = useBookmarksStore((s) => s.loaded);
  const showOtherBookmarks = useSettingsStore((s) => s.showOtherBookmarks);
  const showRecent = useSettingsStore((s) => s.showRecent);
  const isSearchOpen = useSettingsStore((s) => s.isSearchOpen);
  const searchQuery = useUiStore((s) => s.searchQuery);
  const folderStyles = useFolderStylesStore((s) => s.styles);

  if (!loaded) {
    return (
      <div className="tree-container">
        <div className="loading-state">
          <div className="spinner" />
          <span>Loading bookmarks...</span>
        </div>
      </div>
    );
  }

  if (isSearchOpen && shouldSearchBookmarks(searchQuery)) {
    const results = searchBookmarks(tree, searchQuery);
    return (
      <div className="tree-container">
        <div className="search-results-header">{`${results.length} result${results.length === 1 ? '' : 's'}`}</div>
        <ul className="search-results-list">
          {results.map((node) => (
            <li key={node.id}>
              <BookmarkRow node={node} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const bar = findBookmarksBarNode(tree);
  const barChildren = bar?.children ?? [];
  const topLevel = tree[0]?.children ?? [];
  const otherRoots = showOtherBookmarks ? topLevel.filter((node) => node !== bar && !node.url) : [];

  if (barChildren.length === 0 && otherRoots.length === 0) {
    return (
      <div className="tree-container">
        <div className="empty-state">
          <span>{showOtherBookmarks ? 'No bookmarks yet.' : 'No bookmarks in the Bookmarks Bar.'}</span>
        </div>
      </div>
    );
  }

  const styleMap = assignStylesToTree([...barChildren, ...otherRoots], folderStyles);

  return (
    <div className="tree-container">
      <ul>
        {showRecent && recent.length > 0 && <RecentSection nodes={recent} />}
        {sortNodes(barChildren).map((node) => (
          <TreeItem key={node.id} node={node} styleMap={styleMap} />
        ))}
        {otherRoots.map((node) => (
          <TreeItem key={node.id} node={node} styleMap={styleMap} />
        ))}
      </ul>
    </div>
  );
}
