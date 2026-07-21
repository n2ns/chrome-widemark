// Type shims for the classic-script era.
//
// These declarations exist only because the extension currently loads its
// modules as classic <script> tags that attach factories to `window`, and
// because chrome-types omits `chrome.runtime.lastError`. Both shims are
// removed once the ESM migration (phase 1) replaces the global singletons
// with real imports.

// chrome-types is generated from Chrome's formal API schema, which does not
// include `runtime.lastError`; declare it here so callback error checks type.
declare namespace chrome.runtime {
  const lastError: { message?: string } | undefined;
}

// Module singletons attached by the ordered <script src> loaders in
// sidepanel.html. Typed loosely on purpose: this file is deleted in phase 1.
interface Window {
  BookmarkSidebarUtils: any;
  WideMarkIcons: any;
  WideMarkBookmarkTree: any;
  BookmarkDuplicateRenderer: any;
  WideMarkDuplicateFinder: any;
  WideMarkCleanup: any;
  WideMarkModalDialog: any;
  WideMarkContextMenu: any;
  WideMarkSettings: any;
}
