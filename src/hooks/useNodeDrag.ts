import { useState, type DragEvent } from 'react';
import { useSettingsStore } from '../stores/settings.ts';
import { determineDropPosition, hasTransferType, extractLinkInfo } from '../lib/tree-logic.ts';
import { computeMoveDestination } from '../lib/bookmark-utils.ts';
import type { BookmarkNode } from '../types.ts';

const PERMANENT_FOLDER_IDS = ['1', '2', '3'];

// The node currently being dragged, shared across rows (module-level, no
// re-render needed — the dragged row shows its own `dragging` class locally).
let dragged: { id: string | null; node: BookmarkNode | null } = { id: null, node: null };

export interface NodeDragProps {
  draggable: boolean;
  dragClass: string;
  handlers: {
    onDragStart?: (event: DragEvent) => void;
    onDragEnd?: (event: DragEvent) => void;
    onDragOver?: (event: DragEvent) => void;
    onDragLeave?: (event: DragEvent) => void;
    onDrop?: (event: DragEvent) => void;
  };
}

export function useNodeDrag(node: BookmarkNode): NodeDragProps {
  const dragProtection = useSettingsStore((s) => s.dragProtectionEnabled);
  const [dragging, setDragging] = useState(false);
  const [indicator, setIndicator] = useState('');

  // Managed (policy) nodes reject all bookmarks-API writes: not draggable, not
  // a drop target.
  if (node.unmodifiable) {
    return { draggable: false, dragClass: '', handlers: {} };
  }

  const isPermanent = PERMANENT_FOLDER_IDS.includes(node.id);
  const draggable = !dragProtection && !isPermanent;

  const dropPositionFor = (event: DragEvent) => {
    if (isPermanent) return 'inside' as const;
    const rect = event.currentTarget.getBoundingClientRect();
    return determineDropPosition(event.clientY - rect.top, rect.height, !node.url);
  };

  const onDragStart = (event: DragEvent) => {
    if (dragProtection || isPermanent) {
      event.preventDefault();
      return;
    }
    dragged = { id: node.id, node };
    event.dataTransfer.setData('text/plain', node.id);
    event.dataTransfer.setData('application/x-bookmark-id', node.id);
    setDragging(true);
    event.stopPropagation();
  };

  const onDragEnd = (event: DragEvent) => {
    if (dragProtection) return;
    dragged = { id: null, node: null };
    setDragging(false);
    setIndicator('');
    event.stopPropagation();
  };

  const onDragOver = (event: DragEvent) => {
    if (dragProtection || dragged.id === node.id) return;
    const isInternal = hasTransferType(event.dataTransfer, 'application/x-bookmark-id');
    const isExternal = hasTransferType(event.dataTransfer, 'text/uri-list') || hasTransferType(event.dataTransfer, 'text/plain');
    if (!isInternal && !isExternal) return;
    event.preventDefault();
    event.stopPropagation();
    const pos = dropPositionFor(event);
    setIndicator(pos === 'above' ? 'drag-above' : pos === 'below' ? 'drag-below' : 'drag-over');
  };

  const onDragLeave = (event: DragEvent) => {
    if (dragProtection) return;
    setIndicator('');
    event.stopPropagation();
  };

  const onDrop = (event: DragEvent) => {
    if (dragProtection) return;
    event.preventDefault();
    event.stopPropagation();
    const pos = dropPositionFor(event);
    setIndicator('');

    if (hasTransferType(event.dataTransfer, 'application/x-bookmark-id')) {
      const draggedId = event.dataTransfer.getData('application/x-bookmark-id') || dragged.id;
      if (!draggedId || draggedId === node.id) return;
      const dest = computeMoveDestination(dragged.node ?? ({ id: draggedId } as BookmarkNode), node, pos);
      chrome.bookmarks.move(draggedId, dest);
      return;
    }

    const link = extractLinkInfo(event.dataTransfer);
    if (!link) return;
    const dest = computeMoveDestination(null, node, pos);
    chrome.bookmarks.create({ parentId: dest.parentId, index: dest.index, title: link.title, url: link.url });
  };

  const dragClass = `${dragging ? ' dragging' : ''}${indicator ? ` ${indicator}` : ''}`;
  return { draggable, dragClass, handlers: { onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop } };
}
