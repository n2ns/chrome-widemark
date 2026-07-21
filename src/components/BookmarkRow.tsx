import type { MouseEvent } from 'react';
import { useSettingsStore } from '../stores/settings.ts';
import { useContextMenuStore } from '../stores/contextMenu.ts';
import { useUiStore } from '../stores/ui.ts';
import { useNodeDrag } from '../hooks/useNodeDrag.ts';
import { getBookmarkIconSrc, LINK_ICON_DATA_URI } from '../lib/ui-icons.ts';
import { bookmarkDomain } from '../lib/bookmark-utils.ts';
import { handleBookmarkClick } from '../lib/bookmark-click.ts';
import type { BookmarkNode } from '../types.ts';

export function BookmarkRow({ node }: { node: BookmarkNode }) {
  const tooltipEnabled = useSettingsStore((s) => s.tooltipEnabled);
  const leftClickAction = useSettingsStore((s) => s.leftClickAction);
  const focused = useUiStore((s) => s.focusedNodeId === node.id);
  const drag = useNodeDrag(node);
  const url = node.url ?? '';
  const iconSrc = getBookmarkIconSrc({ chromeApi: chrome, bookmarkDomain, url });

  const open = (event: MouseEvent) => handleBookmarkClick(url, event, leftClickAction);

  return (
    <div
      className={`tree-node bookmark-item${drag.dragClass}${focused ? ' kb-focus' : ''}`}
      data-url={url}
      data-node-id={node.id}
      draggable={drag.draggable}
      {...drag.handlers}
      title={tooltipEnabled ? `${node.title}\n${url}` : undefined}
      onClick={open}
      onAuxClick={(event) => {
        if (event.button === 1) open(event);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        useContextMenuStore.getState().open(node, event.clientX, event.clientY);
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
      <span className="node-title">{node.title || url}</span>
    </div>
  );
}
