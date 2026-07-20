# Architecture

WideMark is intentionally lightweight: plain Manifest V3 extension pages, no frontend framework, and no build step beyond copying the unpacked extension bundle for local Chrome testing.

## Runtime Shape

- `manifest.json` declares the side panel page and required permissions.
- `src/background.js` is the MV3 service worker. It only configures action-click behavior for the side panel.
- `src/sidepanel.html` is the extension page shown in Chrome's side panel.
- `src/sidepanel.js` is the composition root. It wires together the controllers below.

## Main Modules

- `src/bookmark-tree-controller.js`: bookmark tree loading, rendering, search results, folder expansion, bookmark clicks, and drag/drop moves.
- `src/settings-controller.js`: settings form, toolbar view routing, search toggle state, reset actions, and footer text.
- `src/context-menu-controller.js`: custom right-click menu state and bookmark actions.
- `src/modal-dialog.js`: shared custom modal dialogs. Browser-native `alert`, `confirm`, and `prompt` should not be used.
- `src/duplicate-finder-controller.js`: duplicate bookmark check flow.
- `src/duplicate-renderer.js`: duplicate result DOM rendering.
- `src/bookmark-utils.js`: pure bookmark helpers and move destination calculation.
- `src/ui-icons.js`: shared SVG and favicon helpers.

## Permission Boundary

WideMark deliberately avoids `host_permissions`. The extension works with Chrome's Bookmarks, Storage, Side Panel, and Favicon APIs only.

This means duplicate detection is local URL grouping, not dead-link scanning. It does not fetch bookmarked websites, open hidden tabs, or request website access.

## Data Boundary

Chrome bookmarks remain Chrome bookmark data. WideMark stores only its own preferences and folder style metadata in Chrome extension storage.

Folder style preferences are stored in `chrome.storage.sync` as records identified by the folder's `dateAdded` timestamp. Bookmark node IDs are profile-local, but creation time is transported verbatim by Chrome bookmark sync (`BookmarkSpecifics.creation_time_us`), so styles follow the same folder on every synced device and survive renames and moves. Each record also carries the folder's title and path, used only to break ties between folders created in the same millisecond and refreshed automatically when they go stale.

## Notes

`src/bookmark-tree-controller.js` is the largest module by design. Tree rendering and drag/drop are kept together because drag/drop depends directly on the rendered node geometry, node type, parent/index metadata, and expansion state.
