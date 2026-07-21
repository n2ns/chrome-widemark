# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Internal
- Migrated the source from vanilla ES5-style UMD scripts to TypeScript. Modules
  are now native ES modules (a single `type="module"` panel entry) compiled by
  `tsc` into `build/` — no bundler. Type checking runs under `strict`,
  `noUncheckedIndexedAccess`, and the `noUnused*`/`noImplicitReturns`/
  `noFallthroughCasesInSwitch`/`noImplicitOverride` flags. Requires Node >=24
  (`engines`). No user-facing behavior change.
- The build/packaging scripts (`scripts/*.ts`) are TypeScript too, type-checked
  by a separate Node-targeted `tsconfig.scripts.json` and run directly via
  Node's `.ts` execution. A `ci.yml` workflow type-checks and tests on push/PR.
- Development now loads the compiled `build/` directory as the unpacked
  extension (`npm run compile`); the packaged zip ships transpiled JS. See
  [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) and
  [docs/TYPESCRIPT_MIGRATION.md](docs/TYPESCRIPT_MIGRATION.md).

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
- Folder styles are now identified by the folder's creation time (dateAdded), which Chrome bookmark sync transports verbatim, so styles follow folders across synced devices and survive renames and moves; styles are written only on explicit user edits.
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
