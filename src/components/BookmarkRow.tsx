import type { KeyboardEvent, MouseEvent } from 'react';
import { useSettingsStore } from '../stores/settings.ts';
import { useContextMenuStore } from '../stores/contextMenu.ts';
import { useUiStore } from '../stores/ui.ts';
import { useOperationsStore } from '../stores/operations.ts';
import { useNodeDrag } from '../hooks/useNodeDrag.ts';
import { getBookmarkIconSrc, LINK_ICON_DATA_URI } from '../lib/ui-icons.ts';
import { bookmarkDomain } from '../lib/bookmark-utils.ts';
import { handleBookmarkClick } from '../lib/bookmark-click.ts';
import type { BookmarkNode } from '../types.ts';
import type { SearchResult } from '../lib/search.ts';
import { SearchResultContent } from './SearchResultContent.tsx';

export function BookmarkRow({ node, focusKey = node.id, searchResult }: { node: BookmarkNode; focusKey?: string; searchResult?: SearchResult }) {
  const tooltipEnabled = useSettingsStore((s) => s.tooltipEnabled);
  const leftClickAction = useSettingsStore((s) => s.leftClickAction);
  const focused = useUiStore((s) => s.focusedNodeId === focusKey);
  const drag = useNodeDrag(node);
  const url = node.url ?? '';
  const iconSrc = getBookmarkIconSrc({ chromeApi: chrome, bookmarkDomain, url });

  const open = (event: MouseEvent) => handleBookmarkClick(url, event, leftClickAction);
  const openFromKeyboard = (event: KeyboardEvent) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    handleBookmarkClick(url, event, leftClickAction);
  };

  return (
    <div
      role="treeitem"
      tabIndex={focused ? 0 : -1}
      data-focus-key={focusKey}
      className={`tree-node bookmark-item${searchResult ? ' search-result' : ''}${drag.dragClass}${focused ? ' kb-focus' : ''}`}
      data-url={url}
      data-node-id={node.id}
      draggable={drag.draggable}
      {...drag.handlers}
      title={tooltipEnabled ? `${node.title}\n${url}` : undefined}
      onClick={open}
      onFocus={() => useUiStore.getState().setFocusedNodeId(focusKey)}
      onKeyDown={openFromKeyboard}
      onAuxClick={(event) => {
        if (event.button === 1) open(event);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        if (node.unmodifiable || useOperationsStore.getState().bookmarkMutationBusy) return;
        useContextMenuStore.getState().open(node, event.clientX, event.clientY, event.currentTarget);
      }}
    >
      <img
        className="node-icon"
        src={iconSrc}
        alt=""
        onError={(event) => {
          event.currentTarget.src = LINK_ICON_DATA_URI;
        }}
      />
      {searchResult ? <SearchResultContent result={searchResult} /> : <span className="node-title">{node.title || url}</span>}
    </div>
  );
}
