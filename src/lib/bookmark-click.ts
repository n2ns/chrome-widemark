// Open a bookmark, honoring the configured left-click action and the
// new-tab modifiers (Ctrl/Cmd/middle-click always open a background tab).
export function handleBookmarkClick(
  url: string,
  event: { ctrlKey?: boolean; metaKey?: boolean; button?: number; preventDefault: () => void },
  leftClickAction: string
) {
  event.preventDefault();

  const forceNewTab = Boolean(event.ctrlKey) || Boolean(event.metaKey) || event.button === 1;
  if (forceNewTab) {
    chrome.tabs.create({ url, active: false });
    return;
  }

  if (leftClickAction === 'new-foreground') {
    chrome.tabs.create({ url, active: true });
  } else if (leftClickAction === 'new-background') {
    chrome.tabs.create({ url, active: false });
  } else {
    chrome.tabs.update({ url });
  }
}
