# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-10-15

### Changed
- The bookmark tree shows its focus ring only for keyboard focus, not after mouse clicks.
- Updated dependencies (including `@crxjs/vite-plugin` 3 and Vitest 5).
- Each release tag now attaches the packaged zip to a GitHub Release and submits to the Chrome Web Store through
  Chrome Web Store API v2 with the shared N2NS service account.

## [1.2.0] - 2026-07-22

### Added
- Added native Chrome localization for English, Spanish, German, French,
  Simplified Chinese, Traditional Chinese, Japanese, Korean, Turkish, and Vietnamese.
- Added automated locale/placeholder/Manifest-length validation and localized
  number and plural formatting.

### Changed
- Folder style metadata remains a simple Chrome Sync list and follows folders
  across normal rename and move operations.
- Disclosed clearly in the UI, privacy policy, and store copy that folder style
  metadata is synchronized by Chrome Sync and is not received by developer servers.
- CI now builds and inspects the packaged extension. The release workflow checks
  package/Manifest/tag versions, uses least privilege and a dedicated environment,
  serializes deployments, and pins Actions to full commit SHAs.
- Raised the minimum Chrome version to 116 to match the side-panel shortcut API.

### Fixed
- Empty-folder cleanup now atomically refuses to delete folders that gained content.
- Bookmark writes and cleanup jobs are serialized across extension panels with the
  Web Locks API; scans cancel cleanly when their view unmounts.
- Collapsed folder descendants are no longer mounted, large folders are no longer
  clipped, and tree/menu/dialog keyboard focus and ARIA behavior were improved.
- Settings and folder-style reloads no longer allow older asynchronous reads to
  overwrite newer local or cross-window changes.

### Internal
- Rewrote the UI on **React 19 + Zustand**, bundled by **Vite** with
  `@crxjs/vite-plugin` (replacing the vanilla-DOM controllers and the
  `tsc`-only build). Bookmark logic stays framework-agnostic in `src/lib/` and
  is unit-tested independently. Tests run on **Vitest** (happy-dom). The shipped
  bundle carries no source maps. No user-facing behavior change intended.
- Migrated the source from vanilla ES5-style UMD scripts to TypeScript. Modules
  are bundled into `build/` by Vite, while `tsc` performs strict type checking.
  Type checking runs under `strict`,
  `noUncheckedIndexedAccess`, and the `noUnused*`/`noImplicitReturns`/
  `noFallthroughCasesInSwitch`/`noImplicitOverride` flags. Requires Node >=24
  (`engines`). No user-facing behavior change.
- The build/packaging scripts (`scripts/*.ts`) are TypeScript too, type-checked
  by a separate Node-targeted `tsconfig.scripts.json` and run directly via
  Node's `.ts` execution. A `ci.yml` workflow type-checks, tests, builds, and
  validates the packaged ZIP on push/PR.
- Development now loads the bundled `build/` directory as the unpacked
  extension (`npm run build`); the packaged zip ships the Vite output. See
  [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## [1.1.0] - 2026-07-21

### Added
- Full bookmark tree: Other Bookmarks and Mobile Bookmarks now render below the Bookmarks Bar (toggleable in Settings).
- Two duplicate-check modes with separate buttons: exact URL and same domain, with a real chunked progress bar.
- Cleanup actions: delete empty folders and merge same-named sibling folders, with confirmation and multi-pass merging.
- "Sort by Name" in the folder right-click menu (folders first, locale- and number-aware).
- Collapsible "Recently Added" section at the top of the tree (toggleable in Settings).
- Keyboard support: Alt+B opens the panel (Chrome 116+), arrow keys navigate the tree, Enter opens, "/" focuses search.
- Middle-click opens bookmarks in a background tab.
- Manually expanded folders persist across side panel sessions.
- ISC LICENSE file.

### Changed
- Folder styles are identified by the folder's creation time (`dateAdded`) so they survive normal renames and moves; styles are written only on explicit user edits.
- Bookmark events, storage sync updates, and import end now refresh an active search in place instead of replacing it with the tree; per-node re-renders are suppressed during imports and batch operations.
- Policy-managed (enterprise) bookmarks are excluded from cleanup, sorting, editing, and drag and drop.

### Fixed
- Deleting or merging folders never removes content that appeared after the confirmation dialog or scan snapshot.
- Opening a dialog while another is open now settles the first one instead of leaving it pending.

## [1.0.2] - 2026-06-28

### Added
- Added support for dragging webpage links into the side panel to create bookmarks at the drop target.
- Added tests for dropped link parsing, compact fallback titles, and invalid or non-web URL rejection.

### Changed
- Updated Chrome Web Store submission guidance for the next release package and dropped-link feature copy.

## [1.0.1] - 2026-06-24

### Added
- Created unit tests verifying domain-based duplicate grouping and sorting by system index.
- Added full URL hover tooltip on duplicate bookmark items.

### Changed
- Modified bookmark rendering order to follow the system bookmarks bar index (`index` property in Chrome database) instead of always placing folders first.
- Updated "Find Duplicates" algorithm to group bookmarks by domain name (hostname) instead of exact URL matches. Clicking a duplicate now correctly opens the specific item's URL.
- Redesigned and scaled up the Help icon (question mark `?`) to remove the outer circle and match the visual size and weight of other toolbar icons.
- Replaced the triple dots (`...`) icon with a scanning box icon to better represent the actions panel's positioning.

## [1.0.0] - 2026-06-19

### Added
- Initial release of WideMark Chrome Extension.
- Compact side panel bookmark browsing, search, and organization.
- Local duplicate bookmark checker.
- Custom folder styling (colors and icons) and persistence.
