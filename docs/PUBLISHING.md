# Publishing

## Chrome Web Store Draft

### Product Name

WideMark: Bookmark Side Panel

### Short Description

A compact bookmark manager in Chrome's side panel. Browse, search, organize, style folders, and find duplicates locally.

### Long Description

WideMark is a lightweight bookmark manager for Chrome's side panel. It keeps bookmarks visible beside the current tab, so users can browse, search, organize, and clean up their bookmarks without opening Chrome's full bookmark manager.

Key features:

- Browse the full bookmark tree — Bookmarks Bar plus Other and Mobile Bookmarks — in a persistent Chrome side panel.
- Search bookmark titles and URLs quickly.
- Open bookmarks in the current tab, a foreground tab, or a background tab (middle-click supported).
- Create, edit, delete, reorder, sort, and move bookmarks.
- Keyboard support: Alt+B opens the panel, arrow keys navigate, "/" focuses search.
- Recently Added section at the top of the tree.
- Customize folder colors and icons; their metadata is synced by Chrome Sync.
- Adjust theme, font size, row spacing, and UI zoom.
- Find duplicate bookmarks locally (exact URL or same domain) without visiting bookmarked websites.
- Delete empty folders and merge same-named sibling folders locally.

WideMark keeps the permission model narrow. It uses Chrome bookmark, storage, side panel, and favicon APIs. It does not request website host permissions and does not scan web pages.

## Permissions Explanation

- `sidePanel`: shows WideMark in Chrome's side panel.
- `bookmarks`: reads and manages bookmarks at the user's request.
- `storage`: saves display, behavior, and folder style settings.
- `favicon`: displays bookmark icons through Chrome's Manifest V3 favicon endpoint.

WideMark does not declare `host_permissions`.

## Privacy Summary

WideMark processes bookmark data locally in the browser. Folder style metadata (folder title, display path, creation timestamp, color, and icon) is stored in Chrome Sync so styles can follow the user's Chrome profile. No data is sent to the developer's servers. WideMark does not sell or use bookmark data for advertising, profiling, analytics, or unrelated purposes.

Before publishing, host the privacy policy and add the hosted URL to the Chrome Web Store Developer Dashboard.

## Support Links

- N2NS Lab: https://n2ns.com
- datafrog.io: https://datafrog.io

## Checklist

- Run `npm run package`.
- Inspect the package with `unzip -l dist/widemark-v<version>.zip`.
- Upload `dist/widemark-v<version>.zip` to the Chrome Web Store.
- Fill the store listing fields from the draft above.
- Capture Chrome Web Store screenshots.
- Host the privacy policy on the project website.
- Add the hosted privacy policy URL to the store listing.
- Complete the privacy practices form.
- Verify the packaged extension contains only the generated runtime files: `manifest.json`, `src/`, `assets/`, `icons/`, `service-worker-loader.js`, and `_locales/`.
- Store the Web Store credentials (`EXTENSION_ID`, `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`) as GitHub repository secrets before using the tag workflow. Pushing a `v*` tag runs the workflow in the `chrome-web-store` environment and publishes without manual approval. The same workflow also creates a GitHub Release for the tag with `dist/widemark-v<version>.zip` attached (release notes are this version's CHANGELOG section plus manual install steps), so users can install by hand as described in the README.
- Reload the unpacked extension and manually test browsing (including Other Bookmarks), search, drag/drop, sorting, settings, duplicate checks, cleanup actions, and keyboard navigation.
