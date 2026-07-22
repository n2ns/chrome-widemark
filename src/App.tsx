import { useEffect } from 'react';
import { useSettingsStore } from './stores/settings.ts';
import { useFolderStylesStore } from './stores/folderStyles.ts';
import { useBookmarksStore } from './stores/bookmarks.ts';
import { useUiStore } from './stores/ui.ts';
import { initChromeSubscriptions } from './stores/subscriptions.ts';
import { useApplySettings } from './hooks/useApplySettings.ts';
import { useKeyboardNav } from './hooks/useKeyboardNav.ts';
import { Toolbar } from './components/Toolbar.tsx';
import { BookmarkTree } from './components/BookmarkTree.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { ActionsView } from './components/ActionsView.tsx';
import { HelpView } from './components/HelpView.tsx';
import { ModalHost } from './components/ModalHost.tsx';
import { ContextMenu } from './components/ContextMenu.tsx';
import { t } from './lib/i18n.ts';

export default function App() {
  useApplySettings();
  useKeyboardNav();
  const view = useUiStore((s) => s.view);

  useEffect(() => {
    let cancelled = false;
    // Subscribe before async hydration so a Chrome Sync/storage event cannot
    // fall into the initialization gap. Store generations prevent stale reads
    // from overwriting a newer event-driven reload.
    initChromeSubscriptions();
    Promise.all([
      useSettingsStore.getState().hydrate(),
      useFolderStylesStore.getState().hydrate(),
      useBookmarksStore.getState().hydrateExpanded(),
    ]).then(() => {
      if (cancelled) return;
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
        {view === 'actions' && <ActionsView />}
        {view === 'help' && <HelpView />}
      </main>
      <footer className="footer">
        <a href="https://n2ns.com" target="_blank" rel="noopener noreferrer">
          N2NS Lab
        </a>
        <span className="footer-dot">·</span>
        <a href="https://datafrog.io/widemark" target="_blank" rel="noopener noreferrer">
          {t('common_docs')}
        </a>
      </footer>
      <ModalHost />
      <ContextMenu />
    </div>
  );
}
