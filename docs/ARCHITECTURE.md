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
- `subscriptions.ts` wires `chrome.bookmarks.on*` and `chrome.storage.onChanged` into the stores at startup.

## Framework-agnostic logic (`src/lib/`)

The bookmark algorithms carry no DOM/React dependency and are covered by their own tests: `bookmark-utils` (domain/keys, duplicates, sorting, folder-style matching), `tree-logic` (bookmarks-bar lookup, drop-position math, dropped-link parsing, search ranking), `duplicate-scan`, `folder-style-assignment`, `cleanup`, `search`, `visible-nodes`, `bookmark-click`, `theme`, `ui-icons`.

Type-only declaration files (`src/types.d.ts`, `src/chrome-shims.d.ts`) emit no JavaScript; the latter augments `chrome-types` with `chrome.runtime.lastError`.

## Permission Boundary

WideMark deliberately avoids `host_permissions`. It uses only Chrome's Bookmarks, Storage, Side Panel, and Favicon APIs. Duplicate detection is local URL/domain grouping — it never fetches bookmarked sites, opens hidden tabs, or requests website access.

## Data Boundary

Chrome bookmarks remain Chrome bookmark data. WideMark stores only its own preferences and folder-style metadata in extension storage. Folder styles live in `chrome.storage.sync` as records identified by the folder's `dateAdded` creation time (transported verbatim by Chrome bookmark sync), so a style follows the same folder across synced devices and survives renames and moves. Title/path on each record only break ties between folders created in the same millisecond. Style records are written only on explicit user edits.

## Notes

`BookmarkTree.tsx` keeps tree rendering and drag/drop together because drag/drop depends on rendered node geometry, node type, parent/index metadata, and expansion state.
