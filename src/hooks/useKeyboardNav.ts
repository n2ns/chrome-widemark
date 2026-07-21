import { useEffect } from 'react';
import { useUiStore } from '../stores/ui.ts';
import { useSettingsStore } from '../stores/settings.ts';
import { useBookmarksStore } from '../stores/bookmarks.ts';
import { useModalStore } from '../stores/modal.ts';
import { useContextMenuStore } from '../stores/contextMenu.ts';
import { getNavigableNodes } from '../lib/visible-nodes.ts';
import { handleBookmarkClick } from '../lib/bookmark-click.ts';
import { shouldSearchBookmarks } from '../lib/tree-logic.ts';

// Global keyboard handling: Escape closes overlays, "/" focuses search, and the
// arrow keys / Enter navigate the tree (matching the pre-React behavior).
export function useKeyboardNav() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (useModalStore.getState().active) useModalStore.getState().cancel();
        if (useContextMenuStore.getState().target) useContextMenuStore.getState().close();
        return;
      }

      const el = event.target as HTMLElement | null;
      const typing = Boolean(el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
      const modalOpen = Boolean(useModalStore.getState().active);
      const inMain = useUiStore.getState().view === 'main';

      if (event.key === '/' && !typing && !modalOpen && inMain) {
        event.preventDefault();
        const settings = useSettingsStore.getState();
        if (!settings.isSearchOpen) settings.setSetting('isSearchOpen', true);
        setTimeout(() => document.getElementById('search-input')?.focus(), 0);
        return;
      }

      if (typing || modalOpen || !inMain) return;

      const bookmarks = useBookmarksStore.getState();
      const ui = useUiStore.getState();
      const settings = useSettingsStore.getState();
      const rows = getNavigableNodes({
        tree: bookmarks.tree,
        recent: bookmarks.recent,
        showOtherBookmarks: settings.showOtherBookmarks,
        showRecent: settings.showRecent,
        recentExpanded: ui.recentExpanded,
        expandedFolderIds: bookmarks.expandedFolderIds,
        searchQuery: ui.searchQuery,
        searchActive: settings.isSearchOpen && shouldSearchBookmarks(ui.searchQuery),
      });
      if (rows.length === 0) return;

      const currentIndex = rows.findIndex((row) => row.focusKey === ui.focusedNodeId);
      const focused = currentIndex >= 0 ? rows[currentIndex]!.node : null;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        ui.setFocusedNodeId(rows[Math.min(currentIndex + 1, rows.length - 1)]!.focusKey);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        ui.setFocusedNodeId(rows[Math.max(currentIndex - 1, 0)]!.focusKey);
      } else if (event.key === 'Enter' && focused) {
        event.preventDefault();
        if (focused.url) {
          handleBookmarkClick(focused.url, event, useSettingsStore.getState().leftClickAction);
        } else {
          bookmarks.setExpanded(focused.id, !bookmarks.expandedFolderIds.has(focused.id));
        }
      } else if (event.key === 'ArrowRight' && focused && !focused.url && !bookmarks.expandedFolderIds.has(focused.id)) {
        event.preventDefault();
        bookmarks.setExpanded(focused.id, true);
      } else if (event.key === 'ArrowLeft' && focused && !focused.url && bookmarks.expandedFolderIds.has(focused.id)) {
        event.preventDefault();
        bookmarks.setExpanded(focused.id, false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
