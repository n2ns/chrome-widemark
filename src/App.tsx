import { useEffect } from 'react';
import { useSettingsStore } from './stores/settings.ts';
import { useFolderStylesStore } from './stores/folderStyles.ts';
import { useBookmarksStore } from './stores/bookmarks.ts';
import { useUiStore } from './stores/ui.ts';
import { initChromeSubscriptions } from './stores/subscriptions.ts';
import { useApplySettings } from './hooks/useApplySettings.ts';
import { Toolbar } from './components/Toolbar.tsx';
import { BookmarkTree } from './components/BookmarkTree.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { ModalHost } from './components/ModalHost.tsx';
import { ContextMenu } from './components/ContextMenu.tsx';

export default function App() {
  useApplySettings();
  const view = useUiStore((s) => s.view);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      useSettingsStore.getState().hydrate(),
      useFolderStylesStore.getState().hydrate(),
      useBookmarksStore.getState().hydrateExpanded(),
    ]).then(() => {
      if (cancelled) return;
      initChromeSubscriptions();
      void useBookmarksStore.getState().reload();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="sidebar-container">
      <Toolbar />
      <main className="content">
        {view === 'main' && (
          <div id="main-view">
            <BookmarkTree />
          </div>
        )}
        {view === 'settings' && <SettingsView />}
        {view === 'actions' && <div id="actions-view" className="secondary-view">Actions — coming soon</div>}
        {view === 'help' && <div id="help-view" className="secondary-view">Help — coming soon</div>}
      </main>
      <ModalHost />
      <ContextMenu />
    </div>
  );
}
