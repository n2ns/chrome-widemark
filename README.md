# WideMark

WideMark is a compact Chrome Manifest V3 bookmark manager for the side panel. It provides a persistent bookmark tree, fast search, folder styling, bookmark editing, drag-and-drop organization, and local duplicate-bookmark detection.

## Features

- Browse the full bookmark tree — Bookmarks Bar plus Other/Mobile Bookmarks — in Chrome's side panel.
- Search bookmark titles and URLs.
- Open bookmarks in the current tab, a foreground tab, or a background tab (middle-click supported).
- Create, edit, delete, reorder, and move bookmarks.
- Sort a folder's contents by name from the right-click menu.
- See a collapsible Recently Added section at the top of the tree.
- Navigate with the keyboard: Alt+B opens the panel, arrow keys walk the tree, `/` focuses search.
- Customize folder colors and icons.
- Adjust theme, font size, row spacing, and UI zoom.
- Find duplicate bookmarks locally, by exact URL or by shared domain.
- Clean up locally: delete empty folders and merge same-named sibling folders.

## Privacy And Permissions

WideMark uses only the permissions needed for bookmark-side-panel behavior:

```json
[
  "sidePanel",
  "bookmarks",
  "storage",
  "favicon"
]
```

It does not declare `host_permissions`. WideMark does not collect, track, upload, or sell user data. Bookmark browsing, settings, and duplicate checks are processed locally in Chrome.

See [PRIVACY.md](PRIVACY.md) for the privacy policy draft.

## Development

Install dependencies:

```bash
npm install
```

Run checks:

```bash
npm run check
npm test
```

Build the packaged extension and sync it to the configured local Chrome test directory:

```bash
npm run build
```

Create a Chrome Web Store upload package:

```bash
npm run package
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for details.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Development](docs/DEVELOPMENT.md)
- [Publishing](docs/PUBLISHING.md)
- [Chrome Web Store Guide](docs/CHROME_WEB_STORE_GUIDE.md)
- [References](docs/REFERENCES.md)

## Project Layout

```text
chrome-widemark/
├── manifest.json
├── tsconfig.json
├── src/                     # TypeScript source (compiled by tsc)
│   ├── background.ts
│   ├── sidepanel.html
│   ├── sidepanel.css
│   ├── sidepanel.ts
│   ├── bookmark-tree-controller.ts
│   ├── settings-controller.ts
│   ├── context-menu-controller.ts
│   ├── duplicate-finder-controller.ts
│   ├── duplicate-renderer.ts
│   ├── cleanup-controller.ts
│   ├── modal-dialog.ts
│   ├── bookmark-utils.ts
│   ├── ui-icons.ts
│   ├── types.d.ts
│   ├── chrome-shims.d.ts
│   └── styles/
├── build/                   # tsc output, git-ignored (Load unpacked here)
├── icons/
├── store-assets/
├── design/
├── scripts/
├── test/
└── docs/
```

## Status

This is a personal project and intentionally avoids heavy process or framework overhead. See [TODO.md](TODO.md) for the current follow-up list.
