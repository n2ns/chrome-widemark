# Web Link Drag and Drop

This note documents the implemented support for dragging webpage links into the WideMark side panel to create bookmarks.

## Behavior

Users can drag a webpage hyperlink or plain URL text into the bookmark tree and drop it on an existing bookmark or folder.

- Dropping on the top or bottom region of a node inserts the new bookmark before or after that node.
- Dropping in the middle region of a folder creates the bookmark inside that folder.
- The bookmark title comes from the dragged anchor text when available.
- If the dragged link has no usable title, WideMark falls back to a compact title based on the URL host and path.

## Permission Boundary

This feature does not require additional Manifest permissions.

WideMark reads only the browser-provided drag data from the `DataTransfer` object:

- `application/x-bookmark-id` for internal bookmark drags.
- `text/uri-list` for standard dragged links.
- `text/plain` for plain URL text fallback.
- `text/html` only to extract local anchor text for the bookmark title.

The extension does not request `host_permissions`, fetch dragged URLs, inspect page content through content scripts, or make network requests for this feature.

## Implementation

The implementation lives in `src/bookmark-tree-controller.ts`.

Internal bookmark drag starts set `application/x-bookmark-id` so existing bookmark reordering can be distinguished from external webpage link drops.

External link drops are parsed by `extractLinkInfo(dataTransfer)`:

1. Prefer the first non-empty, non-comment URL from `text/uri-list`.
2. Fall back to the first whitespace-delimited token from `text/plain`.
3. Accept only `http:` and `https:` URLs.
4. Extract title text from the first `<a>` in `text/html` when available.
5. Fall back to `hostname + pathname` when the dragged title is empty or unavailable.

The drop target is resolved with the existing `computeMoveDestination` helper. External drops call `chrome.bookmarks.create`; internal drags continue to call `chrome.bookmarks.move`.

## Verification

Automated tests in `test/extension.test.mjs` cover:

- `text/uri-list` parsing with comments and multiple URLs.
- Anchor text title extraction.
- Plain text URL fallback.
- Blank anchor text fallback.
- Rejection of invalid URLs and non-web protocols.

Manual release verification should also cover:

1. Build and load the unpacked extension.
2. Drag a normal webpage hyperlink into the side panel.
3. Drop it above and below an existing bookmark.
4. Drop it into a folder.
5. Confirm the created bookmark title, URL, and position are correct.
6. Drag plain URL text into the side panel and confirm the compact fallback title.
7. Re-test internal bookmark and folder reordering.
