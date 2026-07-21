// Allows users to open the side panel by clicking the extension icon.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Keyboard shortcut (default Alt+B) opens the side panel. sidePanel.open
// requires Chrome 116+; earlier versions simply ignore the command.
chrome.commands.onCommand.addListener((command) => {
  if (command !== 'open-widemark' || typeof chrome.sidePanel.open !== 'function') return;
  chrome.windows.getLastFocused({}, (win) => {
    if (chrome.runtime.lastError || !win) return;
    chrome.sidePanel.open({ windowId: win.id }).catch((error) => console.error(error));
  });
});
