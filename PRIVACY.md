# WideMark Privacy Policy

Last updated: 2026-07-22

WideMark is a Chrome extension for browsing, searching, organizing, styling, and finding duplicate bookmarks in Chrome's side panel.

## Data WideMark Accesses

WideMark requests the Chrome `bookmarks` permission so it can read and manage the user's Chrome bookmarks.

Bookmark data may include:

- Bookmark titles.
- Bookmark URLs.
- Folder names and bookmark folder structure.

WideMark also uses Chrome storage to save extension preferences. Theme, display,
click behavior, row spacing, zoom, and folder expansion state are stored locally.
Folder style metadata is stored in Chrome Sync and may include:

- The folder title, display path, and creation timestamp used to identify a folder.
- The custom folder color and icon selected by the user.

## How Data Is Used

WideMark uses bookmark data only to provide user-facing bookmark features:

- Displaying the bookmark tree in the side panel.
- Searching bookmarks by title or URL.
- Opening bookmarks according to user settings.
- Creating, editing, deleting, reordering, sorting, and moving bookmarks.
- Finding duplicate bookmarks locally (by exact URL or by domain).
- Cleaning up locally: deleting empty folders and merging same-named sibling folders.

WideMark does not use bookmark data for advertising, profiling, analytics, or unrelated purposes.

## Local Processing

WideMark processes bookmark data locally in the browser. Folder style metadata is
the exception to local-only storage: Chrome Sync synchronizes it across the user's
Chrome profiles when Chrome Sync is enabled. The developer's servers do not receive
this metadata.

The duplicate bookmark check and the cleanup actions read bookmarks through the Chrome Bookmarks API and work entirely locally. They do not fetch, visit, or scan bookmarked websites.

## Data Sharing

WideMark does not sell, rent, transfer, or share user bookmark data with the developer
or unrelated third parties. WideMark does not send user data to N2NS Lab, datafrog.io,
or any other developer-operated server. Chrome itself may transmit folder style
metadata through Chrome Sync as described above.

## Network Access

WideMark does not request website `host_permissions`.

WideMark uses Chrome's Manifest V3 `_favicon` endpoint through the `favicon` permission to display bookmark icons. It does not use host permissions to fetch website content.

## Data Retention

Bookmark data remains in the user's Chrome browser and Chrome profile.

Local settings are stored using local Chrome extension storage. Folder style metadata
is stored using Chrome Sync storage. Users can remove these categories with Restore
All Defaults and Reset Folder Styles respectively, by clearing extension data, or by
uninstalling the extension. Chrome Sync retention is also governed by the user's
Chrome Sync settings.

## Limited Use

WideMark's use of Chrome permissions is limited to providing and improving its single purpose: bookmark management in the Chrome side panel.

WideMark does not use or transfer user data for advertising, creditworthiness, lending, or any unrelated purpose.

## Contact

For questions about this policy, contact N2NS Lab through:

- https://n2ns.com
- https://datafrog.io
