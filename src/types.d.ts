// Shared domain types for the WideMark side panel.
//
// `BookmarkNode` is Chrome's live bookmark tree node; the other shapes are the
// plain records the extension derives from it (folder styles keyed by creation
// time, duplicate groups, cleanup candidates) and the panel's UI state.

export type BookmarkNode = chrome.bookmarks.BookmarkTreeNode;

export type DropPosition = 'above' | 'below' | 'inside';

export interface MoveDestination {
  parentId: string;
  index?: number;
}

/** A folder's color/icon styling, as chosen in the style dialog. */
export interface FolderStyle {
  color?: string;
  icon?: string;
}

/**
 * A persisted folder-style record. Identified by the folder's `dateAdded`
 * (creation time survives sync, rename, and move); title/path only break ties
 * between folders created in the same millisecond.
 */
export interface FolderStyleRecord extends FolderStyle {
  dateAdded?: number;
  title?: string;
  path?: string[];
}

/** The identity used to match a live folder against its style record. */
export interface FolderIdentity {
  id: string;
  title?: string;
  path?: string[];
  dateAdded?: number;
}

/** A flattened bookmark carrying the folder path it was found under. */
export interface ScannedBookmark {
  id: string;
  title: string;
  url: string;
  folderPath: string[];
}

/** A group of bookmarks sharing the same duplicate key (url or domain). */
export interface DuplicateGroup<TItem = ScannedBookmark> {
  url: string;
  items: TItem[];
}

/** A top-most empty folder reported by cleanup. */
export interface EmptyFolder {
  id: string;
  title: string;
  path: string[];
}

/** A group of same-titled sibling folders; the first is kept, the rest merged. */
export interface SameNameFolderGroup {
  title: string;
  path: string[];
  keepId: string;
  mergeIds: string[];
}

/** Mutable UI state shared across the panel's controllers. */
export interface AppState {
  isSearchOpen: boolean;
  leftClickAction: string;
  dragProtectionEnabled: boolean;
  tooltipEnabled: boolean;
  showOtherBookmarks: boolean;
  showRecent: boolean;
}

/** Reports `chrome.runtime.lastError` (if set) under an action label. */
export type ReportChromeError = (action: string) => void;
