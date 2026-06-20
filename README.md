# WideMark

WideMark is a compact Chrome Manifest V3 bookmark manager for the side panel. It provides a persistent bookmark tree, fast search, folder styling, bookmark editing, drag-and-drop organization, and local duplicate-bookmark detection.

## Features

- Browse bookmarks in Chrome's side panel.
- Search bookmark titles and URLs.
- Open bookmarks in the current tab, a foreground tab, or a background tab.
- Create, edit, delete, reorder, and move bookmarks.
- Customize folder colors and icons.
- Adjust theme, font size, row spacing, and UI zoom.
- Find duplicate bookmarks locally.

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

It does not declare `host_permissions`.

Duplicate detection is local only. It groups matching bookmark URLs and does not fetch bookmarked websites, open hidden tabs, or scan pages.

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
├── src/
│   ├── background.js
│   ├── sidepanel.html
│   ├── sidepanel.css
│   ├── sidepanel.js
│   ├── bookmark-tree-controller.js
│   ├── settings-controller.js
│   ├── context-menu-controller.js
│   ├── duplicate-finder-controller.js
│   ├── duplicate-renderer.js
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

## Status

This is a personal project and intentionally avoids heavy process or framework overhead. See [TODO.md](TODO.md) for the current follow-up list.
