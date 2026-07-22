import { useState, type DragEvent } from 'react';
import { useSettingsStore } from '../stores/settings.ts';
import { useOperationsStore } from '../stores/operations.ts';
import { determineDropPosition, hasTransferType, extractLinkInfo } from '../lib/tree-logic.ts';
import { computeMoveDestination, isPermanentFolder } from '../lib/bookmark-utils.ts';
import { withGlobalBookmarkMutation } from '../lib/bookmark-mutation-lock.ts';
import type { BookmarkNode } from '../types.ts';

// The node currently being dragged, shared across rows (module-level, no
// re-render needed — the dragged row shows its own `dragging` class locally).
let draggedId: string | null = null;
let clearDraggedRow: (() => void) | null = null;

function resetActiveDrag() {
  draggedId = null;
  const clear = clearDraggedRow;
  clearDraggedRow = null;
  clear?.();
}

function readBookmarkNode(id: string): Promise<BookmarkNode> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.get(id, (nodes) => {
      if (chrome.runtime.lastError || !nodes[0]) reject(new Error(chrome.runtime.lastError?.message ?? 'Bookmark not found'));
      else resolve(nodes[0]);
    });
  });
}

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
  const mutationBusy = useOperationsStore((s) => s.bookmarkMutationBusy);
  const [dragging, setDragging] = useState(false);
  const [indicator, setIndicator] = useState('');

  // Managed (policy) nodes reject all bookmarks-API writes: not draggable, not
  // a drop target.
  if (node.unmodifiable || mutationBusy) {
    return { draggable: false, dragClass: '', handlers: {} };
  }

  const isPermanent = isPermanentFolder(node);
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
    resetActiveDrag();
    draggedId = node.id;
    clearDraggedRow = () => {
      setDragging(false);
      setIndicator('');
    };
    event.dataTransfer.setData('text/plain', node.id);
    event.dataTransfer.setData('application/x-bookmark-id', node.id);
    setDragging(true);
    event.stopPropagation();
  };

  const onDragEnd = (event: DragEvent) => {
    resetActiveDrag();
    event.stopPropagation();
  };

  const onDragOver = (event: DragEvent) => {
    if (dragProtection || draggedId === node.id) return;
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
      const sourceId = event.dataTransfer.getData('application/x-bookmark-id') || draggedId;
      resetActiveDrag();
      if (!sourceId || sourceId === node.id) return;
      const operations = useOperationsStore.getState();
      if (!operations.tryBeginMutation()) return;
      void withGlobalBookmarkMutation(async () => {
        const latestTarget = await readBookmarkNode(node.id);
        const dest = computeMoveDestination(latestTarget, pos);
        await new Promise<void>((resolve) => {
          chrome.bookmarks.move(sourceId, dest, () => resolve());
        });
      }).catch(() => undefined).finally(() => operations.finishMutation());
      return;
    }

    const link = extractLinkInfo(event.dataTransfer);
    if (!link) return;
    const operations = useOperationsStore.getState();
    if (!operations.tryBeginMutation()) return;
    void withGlobalBookmarkMutation(async () => {
      const latestTarget = await readBookmarkNode(node.id);
      const dest = computeMoveDestination(latestTarget, pos);
      await new Promise<void>((resolve) => {
      chrome.bookmarks.create(
        { parentId: dest.parentId, index: dest.index, title: link.title, url: link.url },
        () => resolve()
      );
      });
    }).catch(() => undefined).finally(() => operations.finishMutation());
  };

  const dragClass = `${dragging ? ' dragging' : ''}${indicator ? ` ${indicator}` : ''}`;
  return { draggable, dragClass, handlers: { onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop } };
}
