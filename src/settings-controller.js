(function attachWideMarkSettings(root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.WideMarkSettings = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createWideMarkSettingsApi() {
  const THEME_CLASSES = [
    'theme-light',
    'theme-dark',
    'theme-one-dark-pro',
    'theme-dracula',
    'theme-github-dark',
    'theme-everforest',
    'theme-gruvbox'
  ];

  const UI_SETTING_KEYS = ['fontSize', 'fontFamily', 'theme', 'syncTheme', 'rowSpacing', 'uiZoom'];

  function getStoredSetting(result, key, defaultValue) {
    return result[key] !== undefined ? result[key] : defaultValue;
  }

  function createSettingsController({
    document,
    chromeApi,
    state,
    toolbarIcons,
    searchInput,
    clearSearchBtn,
    searchToggleBtn,
    searchBarContainer,
    toggleAllBtn,
    updateToggleAllButton,
    initBookmarkTree,
    loadBookmarks,
    refreshView,
    initFolderStyles,
    modalDialog,
    reportChromeError
  }) {
    const settingsToggleBtn = document.getElementById('settings-toggle-btn');
    const actionsToggleBtn = document.getElementById('actions-toggle-btn');
    const helpToggleBtn = document.getElementById('help-toggle-btn');
    const mainView = document.getElementById('main-view');
    const settingsView = document.getElementById('settings-view');
    const actionsView = document.getElementById('actions-view');
    const helpView = document.getElementById('help-view');

    const settingFontSize = document.getElementById('setting-font-size');
    const settingFontFamily = document.getElementById('setting-font-family');
    const settingTheme = document.getElementById('setting-theme');
    const settingSyncTheme = document.getElementById('setting-sync-theme');
    const settingRowSpacing = document.getElementById('setting-row-spacing');
    const settingUiZoom = document.getElementById('setting-ui-zoom');
    const settingLeftClickAction = document.getElementById('setting-left-click-action');
    const settingDragProtection = document.getElementById('setting-drag-protection');
    const settingTooltipEnabled = document.getElementById('setting-tooltip-enabled');
    const resetFolderStylesBtn = document.getElementById('reset-folder-styles-btn');
    const restoreDefaultsBtn = document.getElementById('restore-defaults-btn');
    const { showConfirmDialog, showInfoDialog } = modalDialog;

    let currentView = 'main';

    function updateSearchBoxState() {
      if (currentView === 'main' && state.isSearchOpen) {
        searchBarContainer.style.display = 'flex';
        searchToggleBtn.classList.add('active');
      } else {
        searchBarContainer.style.display = 'none';
        searchToggleBtn.classList.remove('active');
      }
    }

    function resetToolbarIcons() {
      settingsToggleBtn.title = 'Settings';
      settingsToggleBtn.innerHTML = toolbarIcons.settings;
      actionsToggleBtn.title = 'Actions';
      actionsToggleBtn.innerHTML = toolbarIcons.actions;
      helpToggleBtn.title = 'Help';
      helpToggleBtn.innerHTML = toolbarIcons.help;
    }

    function showMainView() {
      mainView.style.display = 'block';
      searchToggleBtn.style.display = 'inline-flex';
      toggleAllBtn.style.display = 'inline-flex';
      actionsToggleBtn.style.display = 'inline-flex';
      settingsToggleBtn.style.display = 'inline-flex';
      helpToggleBtn.style.display = 'inline-flex';
      resetToolbarIcons();
      updateToggleAllButton();
      updateSearchBoxState();
    }

    function showSecondaryView(viewName) {
      if (viewName === 'settings') {
        settingsView.style.display = 'block';
        settingsToggleBtn.title = 'Back to bookmarks';
        settingsToggleBtn.innerHTML = toolbarIcons.close;
      } else if (viewName === 'actions') {
        actionsView.style.display = 'block';
        actionsToggleBtn.title = 'Back to bookmarks';
        actionsToggleBtn.innerHTML = toolbarIcons.close;
      } else if (viewName === 'help') {
        helpView.style.display = 'block';
        helpToggleBtn.title = 'Back to bookmarks';
        helpToggleBtn.innerHTML = toolbarIcons.close;
      }

      searchToggleBtn.style.display = 'none';
      toggleAllBtn.style.display = 'none';
      if (viewName !== 'settings') settingsToggleBtn.style.display = 'none';
      if (viewName !== 'actions') actionsToggleBtn.style.display = 'none';
      if (viewName !== 'help') helpToggleBtn.style.display = 'none';
      searchBarContainer.style.display = 'none';
    }

    function switchView(viewName) {
      currentView = viewName;
      mainView.style.display = 'none';
      settingsView.style.display = 'none';
      actionsView.style.display = 'none';
      helpView.style.display = 'none';

      if (viewName === 'main') {
        showMainView();
      } else {
        showSecondaryView(viewName);
      }
    }

    function applySettings({ fontSize, fontFamily, theme, syncTheme, rowSpacing, uiZoom }) {
      document.documentElement.style.setProperty('--bookmark-font-size', fontSize);
      document.documentElement.style.setProperty('--bookmark-font-family', `var(--font-family-${fontFamily})`);

      if (syncTheme) {
        document.documentElement.classList.remove(...THEME_CLASSES);
        settingTheme.disabled = true;
      } else {
        settingTheme.disabled = false;
        document.documentElement.classList.remove(...THEME_CLASSES);
        document.documentElement.classList.add(`theme-${theme}`);
      }

      let paddingVal = 'var(--bookmark-padding-medium)';
      if (rowSpacing === 'compact') paddingVal = 'var(--bookmark-padding-compact)';
      else if (rowSpacing === 'relaxed') paddingVal = 'var(--bookmark-padding-relaxed)';
      document.documentElement.style.setProperty('--bookmark-padding', paddingVal);
      document.documentElement.style.setProperty('--ui-zoom', uiZoom || '100%');
    }

    function applyCurrentFormSettings() {
      applySettings({
        fontSize: settingFontSize.value,
        fontFamily: settingFontFamily.value,
        theme: settingTheme.value,
        syncTheme: settingSyncTheme.checked,
        rowSpacing: settingRowSpacing.value,
        uiZoom: settingUiZoom.value
      });
    }

    function setFormValues({ fontSize, fontFamily, theme, syncTheme, rowSpacing, uiZoom }) {
      settingFontSize.value = fontSize;
      settingFontFamily.value = fontFamily;
      settingTheme.value = theme;
      settingSyncTheme.checked = syncTheme;
      settingRowSpacing.value = rowSpacing;
      settingUiZoom.value = uiZoom;
      settingLeftClickAction.value = state.leftClickAction;
      settingDragProtection.checked = state.dragProtectionEnabled;
      settingTooltipEnabled.checked = state.tooltipEnabled;
    }

    function initSettings() {
      chromeApi.storage.local.get([
        'fontSize', 'fontFamily', 'theme', 'syncTheme',
        'isSearchOpen', 'isFoldersExpanded',
        'rowSpacing', 'uiZoom', 'leftClickAction',
        'dragProtectionEnabled', 'tooltipEnabled'
      ], (result) => {
        const fontSize = result.fontSize || '14px';
        const fontFamily = result.fontFamily || 'system';
        const theme = result.theme || 'dark';
        const syncTheme = getStoredSetting(result, 'syncTheme', true);
        const rowSpacing = result.rowSpacing || 'medium';
        const uiZoom = result.uiZoom || '100%';

        state.isSearchOpen = getStoredSetting(result, 'isSearchOpen', false);
        state.isFoldersExpanded = getStoredSetting(result, 'isFoldersExpanded', false);
        state.leftClickAction = result.leftClickAction || 'current';
        state.dragProtectionEnabled = getStoredSetting(result, 'dragProtectionEnabled', false);
        state.tooltipEnabled = getStoredSetting(result, 'tooltipEnabled', true);

        setFormValues({ fontSize, fontFamily, theme, syncTheme, rowSpacing, uiZoom });
        applySettings({ fontSize, fontFamily, theme, syncTheme, rowSpacing, uiZoom });
        updateSearchBoxState();
        initFolderStyles(() => {
          initBookmarkTree();
        });
      });
    }

    function saveSetting(key, value) {
      if (key === 'leftClickAction') {
        state.leftClickAction = value;
      }
      if (key === 'dragProtectionEnabled') state.dragProtectionEnabled = value;
      if (key === 'tooltipEnabled') state.tooltipEnabled = value;

      if (UI_SETTING_KEYS.includes(key)) {
        applyCurrentFormSettings();
      }

      if (key === 'dragProtectionEnabled' || key === 'tooltipEnabled') {
        refreshView();
      }

      chromeApi.storage.local.set({ [key]: value }, () => {
        if (chromeApi.runtime.lastError) {
          reportChromeError('Error saving setting');
        }
      });
    }

    function toggleNamedView(viewName) {
      switchView(currentView === viewName ? 'main' : viewName);
    }

    function bindEvents() {
      settingsToggleBtn.addEventListener('click', () => toggleNamedView('settings'));
      actionsToggleBtn.addEventListener('click', () => toggleNamedView('actions'));
      helpToggleBtn.addEventListener('click', () => toggleNamedView('help'));

      searchToggleBtn.addEventListener('click', () => {
        state.isSearchOpen = !state.isSearchOpen;
        chromeApi.storage.local.set({ isSearchOpen: state.isSearchOpen });
        updateSearchBoxState();
        if (state.isSearchOpen) {
          searchInput.focus();
        } else {
          searchInput.value = '';
          clearSearchBtn.style.display = 'none';
          loadBookmarks(true);
        }
      });

      settingFontSize.addEventListener('change', (event) => saveSetting('fontSize', event.target.value));
      settingFontFamily.addEventListener('change', (event) => saveSetting('fontFamily', event.target.value));
      settingTheme.addEventListener('change', (event) => saveSetting('theme', event.target.value));
      settingSyncTheme.addEventListener('change', (event) => saveSetting('syncTheme', event.target.checked));
      settingRowSpacing.addEventListener('change', (event) => saveSetting('rowSpacing', event.target.value));
      settingUiZoom.addEventListener('change', (event) => saveSetting('uiZoom', event.target.value));
      settingLeftClickAction.addEventListener('change', (event) => saveSetting('leftClickAction', event.target.value));
      settingDragProtection.addEventListener('change', (event) => saveSetting('dragProtectionEnabled', event.target.checked));
      settingTooltipEnabled.addEventListener('change', (event) => saveSetting('tooltipEnabled', event.target.checked));

      resetFolderStylesBtn.addEventListener('click', async () => {
        const confirmed = await showConfirmDialog({
          title: 'Reset Folder Styles',
          message: 'Are you sure you want to reset all custom folder colors and icons? This cannot be undone.',
          confirmLabel: 'Reset'
        });
        if (!confirmed) return;

        chromeApi.storage.sync.remove('folderStyles', () => {
          if (chromeApi.runtime.lastError) {
            reportChromeError('Error clearing custom styles');
            return;
          }
          initFolderStyles(() => {
            refreshView();
            showInfoDialog({
              title: 'Folder Styles Reset',
              message: 'Folder styles have been reset to defaults.'
            });
          });
        });
      });

      restoreDefaultsBtn.addEventListener('click', async () => {
        const confirmed = await showConfirmDialog({
          title: 'Restore Defaults',
          message: 'Restore all settings to their defaults?',
          confirmLabel: 'Restore'
        });
        if (!confirmed) return;

        chromeApi.storage.local.clear(() => {
          if (chromeApi.runtime.lastError) {
            reportChromeError('Error clearing local settings');
            return;
          }
          searchInput.value = '';
          clearSearchBtn.style.display = 'none';
          initSettings();
          showInfoDialog({
            title: 'Settings Restored',
            message: 'All settings have been restored to defaults.'
          });
        });
      });
    }

    bindEvents();

    return {
      initSettings,
      switchView,
      updateSearchBoxState
    };
  }

  return {
    THEME_CLASSES,
    createSettingsController
  };
});
