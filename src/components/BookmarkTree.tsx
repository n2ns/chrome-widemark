import { useBookmarksStore } from '../stores/bookmarks.ts';
import { useSettingsStore } from '../stores/settings.ts';
import { useFolderStylesStore } from '../stores/folderStyles.ts';
import { useUiStore } from '../stores/ui.ts';
import { useContextMenuStore } from '../stores/contextMenu.ts';
import { useOperationsStore } from '../stores/operations.ts';
import { useNodeDrag } from '../hooks/useNodeDrag.ts';
import { sortNodes } from '../lib/bookmark-utils.ts';
import { findBookmarksBarNode, shouldSearchBookmarks } from '../lib/tree-logic.ts';
import { assignStylesToTree } from '../lib/folder-style-assignment.ts';
import { searchBookmarks } from '../lib/search.ts';
import { getNavigableNodes } from '../lib/visible-nodes.ts';
import { getFolderSvgIcon } from '../lib/ui-icons.ts';
import { t, tp } from '../lib/i18n.ts';
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
    <li role="none">
      <div
        role="treeitem"
        tabIndex={focused ? 0 : -1}
        data-focus-key={node.id}
        aria-expanded={expanded}
        className={`tree-node${expanded ? ' expanded' : ''}${drag.dragClass}${focused ? ' kb-focus' : ''}`}
        data-node-id={node.id}
        draggable={drag.draggable}
        {...drag.handlers}
        onClick={() => setExpanded(node.id, !expanded)}
        onFocus={() => useUiStore.getState().setFocusedNodeId(node.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            setExpanded(node.id, !expanded);
          }
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          if (useOperationsStore.getState().bookmarkMutationBusy) return;
          useContextMenuStore.getState().open(node, event.clientX, event.clientY, event.currentTarget);
        }}
      >
        <span
          className="node-icon folder-icon"
          style={style?.color ? { color: style.color } : undefined}
          dangerouslySetInnerHTML={{ __html: iconHtml }}
        />
        <span className="node-title">{node.title}</span>
      </div>
      {expanded && (
        <ul className="nested-tree folder-children" role="group">
          {sortNodes(node.children ?? []).map((child) => (
            <TreeItem key={child.id} node={child} styleMap={styleMap} />
          ))}
        </ul>
      )}
    </li>
  );
}

function TreeItem({ node, styleMap }: { node: BookmarkNode; styleMap: StyleMap }) {
  if (node.url) {
    return (
      <li role="none">
        <BookmarkRow node={node} />
      </li>
    );
  }
  return <FolderRow node={node} styleMap={styleMap} />;
}

function RecentSection({ nodes }: { nodes: BookmarkNode[] }) {
  const expanded = useUiStore((s) => s.recentExpanded);
  const setExpanded = useUiStore((s) => s.setRecentExpanded);
  const focused = useUiStore((s) => s.focusedNodeId === 'recent:header');
  return (
    <li role="none">
      <div
        role="treeitem"
        tabIndex={focused ? 0 : -1}
        data-focus-key="recent:header"
        aria-expanded={expanded}
        className={`tree-node recent-section-header${expanded ? ' expanded' : ''}${focused ? ' kb-focus' : ''}`}
        onClick={() => setExpanded(!expanded)}
        onFocus={() => useUiStore.getState().setFocusedNodeId('recent:header')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            setExpanded(!expanded);
          }
        }}
      >
        <span className="node-icon folder-icon" dangerouslySetInnerHTML={{ __html: getFolderSvgIcon('default') }} />
        <span className="node-title">{t('tree_recently_added')}</span>
      </div>
      {expanded && (
        <ul className="nested-tree folder-children" role="group">
          {nodes.map((node) => (
            <li key={node.id} role="none">
              <BookmarkRow node={node} focusKey={`recent:${node.id}`} />
            </li>
          ))}
        </ul>
      )}
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
  const focusedNodeId = useUiStore((s) => s.focusedNodeId);
  const recentExpanded = useUiStore((s) => s.recentExpanded);
  const expandedFolderIds = useBookmarksStore((s) => s.expandedFolderIds);

  if (!loaded) {
    return (
      <div className="tree-container">
        <div className="loading-state">
          <div className="spinner" />
          <span>{t('tree_loading')}</span>
        </div>
      </div>
    );
  }

  if (isSearchOpen && shouldSearchBookmarks(searchQuery)) {
    const results = searchBookmarks(tree, searchQuery);
    const focusIsVisible = results.some((node) => focusedNodeId === `search:${node.id}`);
    return (
      <div className="tree-container">
        <div className="search-results-header">{tp('tree_result_count_one', 'tree_result_count_other', results.length)}</div>
        <ul className="search-results-list" role="tree" tabIndex={focusIsVisible ? -1 : 0}>
          {results.map((node) => (
            <li key={node.id} role="none">
              <BookmarkRow node={node} focusKey={`search:${node.id}`} />
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

  if (barChildren.length === 0 && otherRoots.length === 0 && !(showRecent && recent.length > 0)) {
    return (
      <div className="tree-container">
        <div className="empty-state">
          <span>{t(showOtherBookmarks ? 'tree_empty_all' : 'tree_empty_bar')}</span>
        </div>
      </div>
    );
  }

  const styleMap = assignStylesToTree([...barChildren, ...otherRoots], folderStyles);
  const focusIsVisible = getNavigableNodes({
    tree,
    recent,
    showOtherBookmarks,
    showRecent,
    recentExpanded,
    expandedFolderIds,
    searchQuery,
    searchActive: false,
  }).some((row) => row.focusKey === focusedNodeId);

  return (
    <div className="tree-container">
      <ul role="tree" aria-label={t('common_bookmarks')} tabIndex={focusIsVisible ? -1 : 0}>
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
