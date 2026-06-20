# Development

## Setup

```bash
npm install
```

## Commands

Validate JavaScript syntax:

```bash
npm run check
```

Run tests:

```bash
npm test
```

Build the packaged extension and sync it to the configured Windows Chrome test directory:

```bash
npm run build
```

Create a Chrome Web Store upload package:

```bash
npm run package
```

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
│   ├── modal-dialog.js
│   ├── bookmark-utils.js
│   ├── ui-icons.js
│   └── styles/
├── icons/
├── scripts/
├── test/
└── docs/
```

## Testing Focus

Current Node tests cover:

- bookmark helper behavior
- duplicate grouping
- drag/drop move destination calculations
- search thresholds and search result ordering
- module load order
- manifest permission surface
- build sync file coverage

Real browser smoke tests are still a future improvement.
