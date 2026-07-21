# Development

## Setup

```bash
npm install
```

## Commands

Type-check and lint syntax (`tsc` over `src/`, plus `node --check` on the build scripts):

```bash
npm run check
```

Run tests:

```bash
npm test
```

Compile `src/` into the loadable `build/` directory:

```bash
npm run compile
```

Build the packaged extension and sync it to the configured Windows Chrome test directory:

```bash
npm run build
```

Create a Chrome Web Store upload package:

```bash
npm run package
```

## Loading the extension for development

The source in `src/` is compiled by `tsc` (see `tsconfig.json`) into `build/`.
Chrome loads the **compiled** tree, not the repo source:

1. Run `npm run compile` (or `npx tsc -p tsconfig.json --watch` to rebuild on save).
2. In `chrome://extensions`, enable Developer mode and **Load unpacked** the
   `build/` directory.
3. After changing a source file, re-run the compile (or rely on `--watch`) and
   click the extension's reload button.

`build/` mirrors the repo layout (`build/manifest.json`, `build/src/…`,
`build/icons/…`), so the manifest's relative paths are unchanged. `build/` is
generated output and is git-ignored.

## Local Build Sync

`npm run build` runs `npm run package`, then uses `scripts/sync-to-windows.sh` to copy `dist/widemark` to the configured Windows path.

Set `WINDOWS_ARTIFACTS_PATH` in `.env`:

```bash
WINDOWS_ARTIFACTS_PATH="/mnt/c/path/to/chrome-widemark-dist"
```

The sync script clears stale files from the target directory before copying the packaged extension bundle.

## Release Package

`npm run package` runs syntax checks, tests, then creates:

```text
dist/
├── widemark/
│   ├── manifest.json
│   ├── src/
│   ├── icons/
│   └── icon.png
└── widemark-v<version>.zip
```

The release zip is intentionally minimal. It should contain only runtime extension files:

- `manifest.json`
- `src/`
- `icons/`
- `icon.png`
- `_locales/` when localization is added

It must not contain development or publishing support files such as `.env`, `node_modules/`, `dist/`, `docs/`, `design/`, `store-assets/`, `scripts/`, `test/`, `README.md`, `TODO.md`, or `package*.json`.

Check the zip contents before upload:

```bash
unzip -l dist/widemark-v<version>.zip
```

Upload the zip file to the Chrome Web Store. `dist/` is generated output and should not be committed.

`npm run build` uses the unpacked `dist/widemark/` directory for local Windows/Chrome testing, so the tested layout matches the release package layout. It also copies the zip file to the parent Windows artifacts directory.

## Project Layout

```text
chrome-widemark/
├── manifest.json
├── src/
│   ├── background.js
│   ├── sidepanel.html
│   ├── sidepanel.css
│   ├── sidepanel.js
│   ├── bookmark-tree-controller.js
│   ├── context-menu-controller.js
│   ├── settings-controller.js
│   ├── duplicate-finder-controller.js
│   ├── duplicate-renderer.js
│   ├── cleanup-controller.js
│   ├── modal-dialog.js
│   ├── bookmark-utils.js
│   ├── ui-icons.js
│   └── styles/
├── icons/
├── store-assets/
├── design/
├── scripts/
├── test/
└── docs/
```

## Testing Focus

Current Node tests cover:

- bookmark helper behavior
- duplicate grouping (exact URL and same domain) and chunked scanning
- folder style record assignment, same-millisecond tie-breaking, and replacement
- folder sorting order, empty-folder detection, and same-name folder grouping (including managed-bookmark exclusion)
- drag/drop move destination calculations
- search thresholds and search result ordering
- ES module exports resolve and the panel loads a single module entry
- manifest permission surface
- build assembly and sync file coverage

Real browser smoke tests are still a future improvement.
