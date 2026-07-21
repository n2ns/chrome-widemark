import { useMemo } from 'react';
import { useSettingsStore } from '../stores/settings.ts';
import { useUiStore } from '../stores/ui.ts';
import { useBookmarksStore } from '../stores/bookmarks.ts';
import { gatherFolderIds, getVisibleRoots } from '../lib/tree-logic.ts';

// Raw SVG markup carried over from the original header; rendered as trusted
// inline icons (our own strings, no user input).
const SVG = {
  brand:
    '<svg class="brand-icon" viewBox="0 0 512 512" width="18" height="18" aria-hidden="true"><rect width="512" height="512" rx="100" fill="#f4f1ea"/><rect x="62" y="76" width="388" height="360" rx="58" fill="#2d3138"/><rect x="95" y="114" width="94" height="284" rx="30" fill="#b88952"/><path d="M121 159h42v126l-21-18-21 18V159z" fill="#f4f1ea"/><rect x="226" y="138" width="158" height="31" rx="15.5" fill="#f4f1ea"/><rect x="226" y="206" width="178" height="31" rx="15.5" fill="#5b8def"/><rect x="226" y="274" width="126" height="31" rx="15.5" fill="#e66b5b"/><rect x="226" y="342" width="151" height="31" rx="15.5" fill="#aeb4bd"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
  expand:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h11"></path><path d="M4 12h8"></path><path d="M4 18h11"></path><path d="M18 9v8"></path><path d="M15 14l3 3 3-3"></path></svg>',
  actions:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"></path><line x1="7" y1="12" x2="17" y2="12"></line></svg>',
  settings:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
  help:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 7.5a4.5 4.5 0 0 1 9 0c0 4.5-4.5 5-4.5 9"></path><line x1="12" y1="21" x2="12.01" y2="21"></line></svg>',
};

function IconButton({ svg, title, onClick }: { svg: string; title: string; onClick: () => void }) {
  return (
    <button className="action-icon-btn" title={title} onClick={onClick} dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

export function Toolbar() {
  const isSearchOpen = useSettingsStore((s) => s.isSearchOpen);
  const showOtherBookmarks = useSettingsStore((s) => s.showOtherBookmarks);
  const setSetting = useSettingsStore((s) => s.setSetting);
  const view = useUiStore((s) => s.view);
  const toggleView = useUiStore((s) => s.toggleView);
  const searchQuery = useUiStore((s) => s.searchQuery);
  const setSearchQuery = useUiStore((s) => s.setSearchQuery);
  const expandAll = useBookmarksStore((s) => s.expandAll);
  const collapseAll = useBookmarksStore((s) => s.collapseAll);
  const tree = useBookmarksStore((s) => s.tree);
  const expandedFolderIds = useBookmarksStore((s) => s.expandedFolderIds);
  const visibleFolderIds = useMemo(
    () => gatherFolderIds(getVisibleRoots(tree, showOtherBookmarks)),
    [tree, showOtherBookmarks]
  );
  const allFoldersExpanded = visibleFolderIds.length > 0 &&
    visibleFolderIds.every((id) => expandedFolderIds.has(id));

  const toggleAll = () => {
    if (!allFoldersExpanded) expandAll();
    else collapseAll();
  };

  return (
    <header className="header">
      <div className="brand-row">
        <div className="brand">
          <span dangerouslySetInnerHTML={{ __html: SVG.brand }} />
          <h1>WideMark</h1>
        </div>
        <div className="header-actions">
          {view === 'main' && (
            <>
              <IconButton svg={SVG.search} title="Toggle Search" onClick={() => setSetting('isSearchOpen', !isSearchOpen)} />
              <IconButton svg={SVG.expand} title={allFoldersExpanded ? 'Collapse all folders' : 'Expand all folders'} onClick={toggleAll} />
            </>
          )}
          <IconButton svg={SVG.actions} title="Actions" onClick={() => toggleView('actions')} />
          <IconButton svg={SVG.settings} title="Settings" onClick={() => toggleView('settings')} />
          <IconButton svg={SVG.help} title="Help" onClick={() => toggleView('help')} />
        </div>
      </div>
      {isSearchOpen && view === 'main' && (
        <div className="search-bar-container" style={{ display: 'flex' }}>
          <input
            type="text"
            id="search-input"
            placeholder="Search bookmarks..."
            autoComplete="off"
            autoFocus
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {searchQuery && (
            <button className="clear-btn" title="Clear search" onClick={() => setSearchQuery('')}>
              ✕
            </button>
          )}
        </div>
      )}
    </header>
  );
}
