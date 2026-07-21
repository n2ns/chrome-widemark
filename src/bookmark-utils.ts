  import type {
    BookmarkNode,
    FolderStyleRecord,
    FolderStyle,
    FolderIdentity,
    DropPosition,
    MoveDestination,
    DuplicateGroup,
    EmptyFolder,
    SameNameFolderGroup
  } from './types.ts';

  // A live folder node carrying the path metadata the panel attaches before
  // matching it against a style record.


  function bookmarkDomain(url: string): string | null {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.hostname : null;
    } catch (error) {
      return null;
    }
  }

  function sortNodes<T extends { index?: number }>(nodesList: T[]): T[] {
    return [...nodesList].sort((a, b) => {
      const aIndex = typeof a.index === 'number' ? a.index : 0;
      const bIndex = typeof b.index === 'number' ? b.index : 0;
      return aIndex - bIndex;
    });
  }

  function computeMoveDestination(
    draggedNode: BookmarkNode | null | undefined,
    targetNode: BookmarkNode,
    dropPosition: DropPosition
  ): MoveDestination {
    if (dropPosition === 'inside') {
      return { parentId: targetNode.id };
    }

    const targetParentId = targetNode.parentId!;
    let targetIndex = dropPosition === 'below'
      ? targetNode.index! + 1
      : targetNode.index!;

    if (
      dropPosition === 'above' &&
      draggedNode &&
      draggedNode.parentId === targetParentId &&
      Number.isInteger(draggedNode.index) &&
      draggedNode.index! < targetIndex
    ) {
      targetIndex -= 1;
    }

    return { parentId: targetParentId, index: targetIndex };
  }

  function bookmarkUrlKey(url: string): string | null {
    try {
      return new URL(String(url).trim()).href;
    } catch (error) {
      return null;
    }
  }

  function bookmarkDomainKey(url: string): string | null {
    const domain = bookmarkDomain(url);
    return domain ? domain.trim().toLowerCase() : null;
  }

  function addBookmarksToKeyMap<T extends { url?: string }>(
    bookmarks: T[],
    keyFn: (url: string) => string | null,
    keyMap: Map<string, T[]> = new Map()
  ): Map<string, T[]> {
    bookmarks.forEach((bookmark) => {
      if (!bookmark || !bookmark.url) return;
      const key = keyFn(bookmark.url);
      if (!key) return;
      if (!keyMap.has(key)) {
        keyMap.set(key, []);
      }
      keyMap.get(key)!.push(bookmark);
    });
    return keyMap;
  }

  function collectDuplicateGroups<T>(keyMap: Map<string, T[]>): DuplicateGroup<T>[] {
    const duplicates: DuplicateGroup<T>[] = [];
    keyMap.forEach((items, key) => {
      if (items.length > 1) {
        duplicates.push({ url: key, items });
      }
    });
    return duplicates;
  }

  function findDuplicateBookmarks(bookmarks: BookmarkNode[]): DuplicateGroup<BookmarkNode>[] {
    return collectDuplicateGroups(addBookmarksToKeyMap(bookmarks, bookmarkDomainKey));
  }

  function findDuplicateBookmarksByUrl(bookmarks: BookmarkNode[]): DuplicateGroup<BookmarkNode>[] {
    return collectDuplicateGroups(addBookmarksToKeyMap(bookmarks, bookmarkUrlKey));
  }

  // Sort order for one-click folder sorting: folders first, then bookmarks,
  // each alphabetically (locale-aware, numeric-aware, case-insensitive).
  function computeSortedChildren(children: BookmarkNode[]): BookmarkNode[] {
    const compare = (a: BookmarkNode, b: BookmarkNode) => (a.title || '').localeCompare(b.title || '', undefined, {
      numeric: true,
      sensitivity: 'base'
    });
    const folders = children.filter((child) => !child.url).sort(compare);
    const bookmarks = children.filter((child) => child.url).sort(compare);
    return [...folders, ...bookmarks];
  }

  const PERMANENT_FOLDER_IDS = ['0', '1', '2', '3'];

  // Top-most folders containing no bookmarks anywhere below them (a folder
  // whose children are all deep-empty folders counts as empty itself).
  // Permanent Chrome folders are never reported.
  function findEmptyFolders(treeNodes: BookmarkNode[]): EmptyFolder[] {
    const empties: EmptyFolder[] = [];

    function isDeepEmpty(node: BookmarkNode): boolean {
      if (node.url) return false;
      return (node.children || []).every(isDeepEmpty);
    }

    function walk(nodes: BookmarkNode[], path: string[]): void {
      nodes.forEach((node) => {
        if (node.url || node.unmodifiable) return;
        const nodePath = [...path, node.title];
        if (!PERMANENT_FOLDER_IDS.includes(node.id) && isDeepEmpty(node)) {
          empties.push({ id: node.id, title: node.title, path: nodePath });
          return; // topmost only: removing it removes everything below
        }
        walk(node.children || [], nodePath);
      });
    }

    const rootNode = treeNodes && treeNodes[0];
    walk(rootNode && rootNode.children ? rootNode.children : [], []);
    return empties;
  }

  // Groups of same-titled sibling folders. The lowest-index folder of each
  // group is kept; the rest are merge candidates.
  function findSameNameFolderGroups(treeNodes: BookmarkNode[]): SameNameFolderGroup[] {
    const groups: SameNameFolderGroup[] = [];

    function walk(nodes: BookmarkNode[], path: string[]): void {
      const folders = nodes.filter((node) =>
        !node.url && !node.unmodifiable && !PERMANENT_FOLDER_IDS.includes(node.id));
      const byTitle = new Map<string, BookmarkNode[]>();
      folders.forEach((folder) => {
        if (!byTitle.has(folder.title)) byTitle.set(folder.title, []);
        byTitle.get(folder.title)!.push(folder);
      });
      byTitle.forEach((sameTitle, title) => {
        if (sameTitle.length < 2) return;
        const ordered = sortNodes(sameTitle);
        groups.push({
          title,
          path: [...path, title],
          keepId: ordered[0]!.id,
          mergeIds: ordered.slice(1).map((folder) => folder.id)
        });
      });
      nodes.forEach((node) => {
        if (!node.url && !node.unmodifiable) {
          walk(node.children || [], [...path, node.title]);
        }
      });
    }

    const rootNode = treeNodes && treeNodes[0];
    walk(rootNode && rootNode.children ? rootNode.children : [], []);
    return groups;
  }

  // Folder styles are stored as an array of records identified by the
  // folder's dateAdded (creation time). Node ids are profile-local, but
  // Chrome bookmark sync transports creation time verbatim
  // (BookmarkSpecifics.creation_time_us), so dateAdded is identical on every
  // synced device and survives renames and moves. title/path only break ties
  // between folders created in the same millisecond (e.g. bulk imports) and
  // are refreshed ("healed") whenever a render finds them out of date.
  function sameFolderPath(a?: string[], b?: string[]): boolean {
    return Array.isArray(a) && Array.isArray(b) &&
      a.length === b.length &&
      a.every((title, i) => title === b[i]);
  }

  function commonPathSuffixLength(a?: string[], b?: string[]): number {
    if (!Array.isArray(a) || !Array.isArray(b)) return 0;
    let n = 0;
    while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) {
      n += 1;
    }
    return n;
  }

  function isDefaultFolderStyle(style?: FolderStyle | null): boolean {
    return !style || (!style.color && (!style.icon || style.icon === 'default'));
  }

  function normalizeFolderStyleRecords(value: unknown): FolderStyleRecord[] {
    return Array.isArray(value) ? value : [];
  }

  // Assign style records to the folders of one full render pass. Working on
  // the whole tree at once is what makes same-millisecond twins safe: a
  // record is matched one-to-one against every live folder sharing its
  // dateAdded, so a lone record can never be claimed by a twin of the folder
  // it belongs to. Record title/path metadata is deliberately never written
  // back outside an explicit user edit — an automatic "heal" write would
  // ping-pong between devices whose trees disagree (e.g. bookmark sync lag
  // or bookmark sync turned off while extension sync stays on).
  function assignFolderStyles(
    styleRecords: FolderStyleRecord[],
    folders: FolderIdentity[]
  ): Map<string, FolderStyleRecord> {
    const foldersByDate = new Map<number | undefined, FolderIdentity[]>();
    folders.forEach((folder) => {
      if (!foldersByDate.has(folder.dateAdded)) {
        foldersByDate.set(folder.dateAdded, []);
      }
      foldersByDate.get(folder.dateAdded)!.push(folder);
    });

    const recordsByDate = new Map<number | undefined, FolderStyleRecord[]>();
    styleRecords.forEach((record) => {
      if (!recordsByDate.has(record.dateAdded)) {
        recordsByDate.set(record.dateAdded, []);
      }
      recordsByDate.get(record.dateAdded)!.push(record);
    });

    const byFolderId = new Map<string, FolderStyleRecord>();

    recordsByDate.forEach((records, dateAdded) => {
      const dateFolders = foldersByDate.get(dateAdded) || [];
      if (dateFolders.length === 0) return;

      if (dateFolders.length === 1 && records.length === 1) {
        // Unique on both sides: dateAdded alone identifies the folder, no
        // matter how stale the record's title/path metadata is.
        byFolderId.set(dateFolders[0]!.id, records[0]!);
        return;
      }

      // Twins: one-to-one match by exact title AND path; then by title,
      // preferring the record whose path shares the longest suffix with the
      // folder's (a renamed common ancestor changes path prefixes, but the
      // distinguishing tail — e.g. Work/News vs Home/News — survives); then
      // by exact path. Leftovers stay unassigned rather than guessed.
      let unmatchedFolders = [...dateFolders];
      let unmatchedRecords = [...records];
      ([
        (folder: FolderIdentity, candidates: FolderStyleRecord[]) => candidates.findIndex(
          (record) => record.title === folder.title && sameFolderPath(record.path, folder.path)
        ),
        (folder: FolderIdentity, candidates: FolderStyleRecord[]) => {
          let bestIndex = -1;
          let bestSuffix = -1;
          candidates.forEach((record, index) => {
            if (record.title !== folder.title) return;
            const suffix = commonPathSuffixLength(record.path, folder.path);
            if (suffix > bestSuffix) {
              bestSuffix = suffix;
              bestIndex = index;
            }
          });
          return bestIndex;
        },
        (folder: FolderIdentity, candidates: FolderStyleRecord[]) => candidates.findIndex(
          (record) => sameFolderPath(record.path, folder.path)
        )
      ] as Array<(folder: FolderIdentity, candidates: FolderStyleRecord[]) => number>).forEach((selectRecord) => {
        unmatchedFolders = unmatchedFolders.filter((folder) => {
          const recordIndex = selectRecord(folder, unmatchedRecords);
          if (recordIndex === -1) return true;
          byFolderId.set(folder.id, unmatchedRecords[recordIndex]!);
          unmatchedRecords.splice(recordIndex, 1);
          return false;
        });
      });
    });

    return byFolderId;
  }

  function replaceFolderStyle(
    styleRecords: FolderStyleRecord[],
    existingRecord: FolderStyleRecord | null | undefined,
    { dateAdded, title, path }: { dateAdded?: number; title?: string; path?: string[] },
    style: FolderStyle
  ): FolderStyleRecord[] {
    const next = styleRecords.filter((record) => {
      if (record === existingRecord) return false;
      // Also drop a record that identifies the same folder even if the
      // reference went stale (e.g. the array was replaced by a sync update
      // while the style dialog was open).
      return !(record.dateAdded === dateAdded &&
        record.title === title &&
        sameFolderPath(record.path, path));
    });
    if (!isDefaultFolderStyle(style)) {
      next.push({
        dateAdded,
        title,
        path,
        color: style.color || '',
        icon: style.icon || 'default'
      });
    }
    return next;
  }

  export {
    bookmarkDomain,
    bookmarkUrlKey,
    bookmarkDomainKey,
    addBookmarksToKeyMap,
    collectDuplicateGroups,
    sortNodes,
    computeMoveDestination,
    computeSortedChildren,
    findEmptyFolders,
    findSameNameFolderGroups,
    findDuplicateBookmarks,
    findDuplicateBookmarksByUrl,
    sameFolderPath,
    isDefaultFolderStyle,
    normalizeFolderStyleRecords,
    assignFolderStyles,
    replaceFolderStyle
  };
