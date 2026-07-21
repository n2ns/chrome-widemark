# Architecture

WideMark is intentionally lightweight: plain Manifest V3 extension pages and no frontend framework. The source is TypeScript compiled by `tsc` (no bundler); the only build step transpiles `src/**/*.ts` into `build/` and copies the static assets alongside it (see [DEVELOPMENT.md](DEVELOPMENT.md) and `tsconfig.json`).

## Module System

The panel scripts are native ES modules. `src/sidepanel.html` loads a single entry, `<script type="module" src="sidepanel.js">`; every other module is pulled in through the import graph rather than ordered `<script>` tags. Each module uses `export`/`import` and is dependency-injected by the composition root — controllers receive their collaborators as a parameter bag instead of reaching for globals.

Shared types live in two declaration files that emit no JavaScript:

- `src/types.d.ts`: shared domain types (`BookmarkNode`, `FolderStyleRecord`, `DropPosition`, `AppState`, `DuplicateGroup`, …).
- `src/chrome-shims.d.ts`: augments `chrome-types` with `chrome.runtime.lastError`, which the generated API schema omits.

## Runtime Shape

- `manifest.json` declares the side panel page and required permissions. Its asset paths (`src/background.js`, `src/sidepanel.html`) point at the compiled `build/` tree.
- `src/background.ts` is the MV3 service worker. It configures action-click behavior for the side panel and handles the keyboard command (default Alt+B) that opens it.
- `src/sidepanel.html` is the extension page shown in Chrome's side panel.
- `src/sidepanel.ts` is the composition root. It imports and wires together the controllers below.

## Main Modules

- `src/bookmark-tree-controller.ts`: bookmark tree loading, rendering, search results, folder expansion, bookmark clicks, and drag/drop moves.
- `src/settings-controller.ts`: settings form, toolbar view routing, search toggle state, reset actions, and footer text.
- `src/context-menu-controller.ts`: custom right-click menu state and bookmark actions.
- `src/modal-dialog.ts`: shared custom modal dialogs. Browser-native `alert`, `confirm`, and `prompt` should not be used.
- `src/duplicate-finder-controller.ts`: duplicate bookmark check flow.
- `src/duplicate-renderer.ts`: duplicate result DOM rendering.
- `src/cleanup-controller.ts`: empty-folder deletion and same-named sibling folder merging.
- `src/bookmark-utils.ts`: pure bookmark helpers and move destination calculation.
- `src/ui-icons.ts`: shared SVG and favicon helpers.

## Permission Boundary

WideMark deliberately avoids `host_permissions`. The extension works with Chrome's Bookmarks, Storage, Side Panel, and Favicon APIs only.

This means duplicate detection is local URL grouping, not dead-link scanning. It does not fetch bookmarked websites, open hidden tabs, or request website access.

## Data Boundary

Chrome bookmarks remain Chrome bookmark data. WideMark stores only its own preferences and folder style metadata in Chrome extension storage.

Folder style preferences are stored in `chrome.storage.sync` as records identified by the folder's `dateAdded` timestamp. Bookmark node IDs are profile-local, but creation time is transported verbatim by Chrome bookmark sync (`BookmarkSpecifics.creation_time_us`), so styles follow the same folder on every synced device and survive renames and moves. Each record also carries the folder's title and path, used only to break ties between folders created in the same millisecond (matching by title and path together, then title, then path; ambiguous leftovers are left unstyled rather than guessed). Style records are written only on explicit user edits — never automatically — so devices whose bookmark trees temporarily disagree cannot ping-pong writes at each other.

## Notes

`src/bookmark-tree-controller.ts` is the largest module by design. Tree rendering and drag/drop are kept together because drag/drop depends directly on the rendered node geometry, node type, parent/index metadata, and expansion state.
