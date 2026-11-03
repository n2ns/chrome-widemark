# Architecture

WideMark is a Manifest V3 side-panel bookmark manager built with **React 19 + TypeScript**, bundled by **Vite** with **@crxjs/vite-plugin**. UI state is held in small **Zustand** stores; all bookmark logic is framework-agnostic and unit-tested independently of React.

## Build

`vite build` (via `@crxjs/vite-plugin`, which reads `manifest.json`) emits a loadable unpacked extension into `build/`. There is no separate `tsc` emit step — TypeScript runs only as a type checker (`tsc --noEmit`). See [DEVELOPMENT.md](DEVELOPMENT.md).

## Layers

```
manifest.json ──▶ @crxjs ──▶ build/  (loadable extension)
                    ├── src/background.ts     MV3 service worker (no React)
                    └── src/sidepanel.html ──▶ src/main.tsx ──▶ <App/>

<App/>
 ├── Toolbar               brand + view routing + search toggle / expand-all
 ├── BookmarkTree          tree render, folders/bookmarks, search, drag/drop
 ├── SettingsView          display/behavior settings + reset actions
 ├── ActionsView           duplicate finder + cleanup (empty / merge)
 ├── HelpView              help + about
 ├── ModalHost (portal)    confirm / alert / input / folder-style dialogs
 └── ContextMenu (portal)  right-click add/edit/delete/sort/style
```

## State — Zustand stores (`src/stores/`)

- `settings` — display + behavior settings and view flags, persisted to `chrome.storage.local`.
- `folderStyles` — folder color/icon records, cached from `chrome.storage.sync`; external changes are de-duplicated.
- `bookmarks` — the bookmark tree, recently-added list, and expansion state. Chrome bookmark events reload the tree, with per-event reloads suppressed during a bulk import or an explicit batch (sort/cleanup).
- `ui` — ephemeral view/search/focus state.
- `modal` / `contextMenu` — the currently open dialog (promise-based) and right-click target.
- `operations` — panel-wide bookmark-mutation/cleanup lock and cleanup status, preventing destructive jobs from overlapping other writes in the same panel.
- `subscriptions.ts` wires `chrome.bookmarks.on*` and `chrome.storage.onChanged` into the stores at startup.

## Framework-agnostic logic (`src/lib/`)

The bookmark algorithms carry no DOM/React dependency and are covered by their own tests: `bookmark-utils` (domain/keys, duplicates, sorting, folder-style matching), `tree-logic` (bookmarks-bar lookup, drop-position math, dropped-link parsing, search ranking), `duplicate-scan`, `folder-style-assignment`, `folder-style-storage`, `cleanup`, `search`, `visible-nodes`, `bookmark-click`, `theme`, `ui-icons`.

The type-only declaration file `src/types.d.ts` emits no JavaScript. Chrome API types, including `chrome.runtime.lastError`, come from `chrome-types`.

## Permission Boundary

WideMark deliberately avoids `host_permissions`. It uses only Chrome's Bookmarks, Storage, Side Panel, and Favicon APIs. Duplicate detection is local URL/domain grouping — it never fetches bookmarked sites, opens hidden tabs, or requests website access.

## Data Boundary

Chrome bookmarks remain Chrome bookmark data. WideMark stores only its own preferences and folder style metadata in extension storage. Folder styles use `dateAdded` as their rename/move-stable identity, with title/path metadata for rare same-millisecond collisions. Matching always includes the complete folder tree, independent of visibility or search. Bookmarks Bar descendants retain their existing bar-relative paths; other roots retain their root-prefixed paths.

Styles are synchronized by Chrome Sync when enabled and are never sent to developer-operated servers. The legacy `folderStyles` array remains readable and migrates on the next successful style edit to a versioned index plus `folderStyles:<n>` chunks, each within Chrome Sync's 8 KB item limit. Index and chunks share a revision; incomplete snapshots are rejected until synchronization completes. The total Sync quota and write limits still apply.

Empty-folder cleanup re-reads each confirmed subtree, skips it if it now contains bookmarks, and removes empty folders from the leaves up. Each deletion uses `chrome.bookmarks.remove` so content added during cleanup is preserved. The reported count is the number of confirmed subtree roots successfully removed.

## Internationalization

The extension uses Chrome's native `_locales` message catalogs. `src/lib/i18n.ts` provides typed lookups and locale-aware number/plural formatting, while `scripts/check-i18n.ts` verifies exact key parity, locale directory coverage, placeholders, Manifest references, and Manifest field lengths for every supported locale.

## Notes

`BookmarkTree.tsx` keeps tree rendering and drag/drop together because drag/drop depends on rendered node geometry, node type, parent/index metadata, and expansion state.
