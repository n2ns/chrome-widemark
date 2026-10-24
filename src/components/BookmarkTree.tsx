import { useLayoutEffect, useMemo, useRef } from 'react';
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
import { searchBookmarks, type SearchResult } from '../lib/search.ts';
import { revealBookmark } from '../lib/reveal-bookmark.ts';
import { getNavigableNodes } from '../lib/visible-nodes.ts';
import { getFolderSvgIcon } from '../lib/ui-icons.ts';
import { t, tp } from '../lib/i18n.ts';
import { BookmarkRow } from './BookmarkRow.tsx';
import { SearchResultContent } from './SearchResultContent.tsx';
import type { BookmarkNode, FolderStyleRecord } from '../types.ts';

type StyleMap = Map<string, FolderStyleRecord>;

function FolderRow({ node, styleMap, searchResult }: { node: BookmarkNode; styleMap: StyleMap; searchResult?: SearchResult }) {
  const expanded = useBookmarksStore((s) => s.expandedFolderIds.has(node.id));
  const setExpanded = useBookmarksStore((s) => s.setExpanded);
  const focusKey = searchResult ? `search:${node.id}` : node.id;
  const focused = useUiStore((s) => s.focusedNodeId === focusKey);
  const drag = useNodeDrag(node);
  const style = styleMap.get(node.id);
  const iconHtml = getFolderSvgIcon(style?.icon && style.icon !== 'default' ? style.icon : 'default');
  const activate = () => searchResult ? revealBookmark(node.id) : setExpanded(node.id, !expanded);

  return (
    <li role="none">
      <div
        role="treeitem"
        tabIndex={focused ? 0 : -1}
        data-focus-key={focusKey}
        aria-expanded={searchResult ? undefined : expanded}
        className={`tree-node${searchResult ? ' search-result' : expanded ? ' expanded' : ''}${drag.dragClass}${focused ? ' kb-focus' : ''}`}
        data-node-id={node.id}
        draggable={drag.draggable}
        {...drag.handlers}
        onClick={activate}
        onFocus={() => useUiStore.getState().setFocusedNodeId(focusKey)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            activate();
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
        {searchResult ? <SearchResultContent result={searchResult} /> : <span className="node-title">{node.title}</span>}
      </div>
      {!searchResult && expanded && (
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
  const revealedRootId = useUiStore((s) => s.revealedRootId);
  const revealTargetId = useUiStore((s) => s.revealTargetId);
  const treeRef = useRef<HTMLDivElement>(null);
  const searchActive = isSearchOpen && shouldSearchBookmarks(searchQuery);
  const results = useMemo(() => searchActive ? searchBookmarks(tree, searchQuery) : [], [tree, searchQuery, searchActive]);

  useLayoutEffect(() => {
    if (!revealTargetId || searchActive) return;
    const target = [...(treeRef.current?.querySelectorAll<HTMLElement>('[data-focus-key]') ?? [])]
      .find((row) => row.dataset.focusKey === revealTargetId);
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView?.({ block: 'nearest' });
      useUiStore.setState({ revealTargetId: null });
    }
  }, [revealTargetId, searchActive, tree]);

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

  if (searchActive) {
    const styleMap = assignStylesToTree(tree[0]?.children ?? [], folderStyles);
    const focusIsVisible = results.some((node) => focusedNodeId === `search:${node.id}`);
    return (
      <div className="tree-container">
        <div className="search-results-header">{tp('tree_result_count_one', 'tree_result_count_other', results.length)}</div>
        <ul className="search-results-list" role="tree" tabIndex={focusIsVisible ? -1 : 0}>
          {results.map((node) => node.url ? (
            <li key={node.id} role="none">
              <BookmarkRow node={node} focusKey={`search:${node.id}`} searchResult={node} />
            </li>
          ) : <FolderRow key={node.id} node={node} styleMap={styleMap} searchResult={node} />)}
        </ul>
      </div>
    );
  }

  const bar = findBookmarksBarNode(tree);
  const barChildren = bar?.children ?? [];
  const topLevel = tree[0]?.children ?? [];
  const otherRoots = topLevel.filter((node) => node !== bar && !node.url && (showOtherBookmarks || node.id === revealedRootId));
  const showBarRoot = Boolean(bar && bar.id === revealedRootId);

  if (!showBarRoot && barChildren.length === 0 && otherRoots.length === 0 && !(showRecent && recent.length > 0)) {
    return (
      <div className="tree-container">
        <div className="empty-state">
          <span>{t(showOtherBookmarks ? 'tree_empty_all' : 'tree_empty_bar')}</span>
        </div>
      </div>
    );
  }

  const barNodes = showBarRoot && bar ? [bar] : barChildren;
  const styleMap = assignStylesToTree([...barNodes, ...otherRoots], folderStyles);
  const focusIsVisible = getNavigableNodes({
    tree,
    recent,
    showOtherBookmarks,
    showRecent,
    recentExpanded,
    expandedFolderIds,
    searchQuery,
    searchActive: false,
    revealedRootId,
  }).some((row) => row.focusKey === focusedNodeId);

  return (
    <div className="tree-container" ref={treeRef}>
      <ul role="tree" aria-label={t('common_bookmarks')} tabIndex={focusIsVisible ? -1 : 0}>
        {showRecent && recent.length > 0 && <RecentSection nodes={recent} />}
        {sortNodes(barNodes).map((node) => (
          <TreeItem key={node.id} node={node} styleMap={styleMap} />
        ))}
        {otherRoots.map((node) => (
          <TreeItem key={node.id} node={node} styleMap={styleMap} />
        ))}
      </ul>
    </div>
  );
}
