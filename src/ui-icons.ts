  const LINK_ICON_DATA_URI = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';

  const toolbarIcons = {
    expandAll: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h11"></path><path d="M4 12h8"></path><path d="M4 18h11"></path><path d="M18 9v8"></path><path d="M15 14l3 3 3-3"></path></svg>',
    collapseAll: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h11"></path><path d="M4 12h8"></path><path d="M4 18h11"></path><path d="M18 15V7"></path><path d="M15 10l3-3 3 3"></path></svg>',
    settings: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    actions: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"></path><line x1="7" y1="12" x2="17" y2="12"></line></svg>',
    help: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 7.5a4.5 4.5 0 0 1 9 0c0 4.5-4.5 5-4.5 9"></path><line x1="12" y1="21" x2="12.01" y2="21"></line></svg>',
    close: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
  };

  const RECENT_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15.5 14"></polyline></svg>';

  interface GetBookmarkIconSrcArgs {
    chromeApi: typeof chrome;
    bookmarkDomain: (url: string) => string | null | undefined;
    url: string;
  }

  function getBookmarkIconSrc({ chromeApi, bookmarkDomain, url }: GetBookmarkIconSrcArgs): string {
    const domain = bookmarkDomain(url);
    if (!domain) {
      return LINK_ICON_DATA_URI;
    }
    return `${chromeApi.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(url)}&size=32`;
  }

  function getFolderSvgIcon(iconName: string | undefined): string {
    const bgPath = '<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" fill="currentColor" fill-opacity="0.65"/>';
    switch (iconName) {
      case 'code':
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none">${bgPath}<path d="M8 10l-3 2.5 3 2.5M16 15l3-2.5-3-2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      case 'document':
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none">${bgPath}<path d="M8 9h8M8 12h8M8 15h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      case 'star':
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none">${bgPath}<path d="M12 7.5l1.2 2.6 2.9.4-2.1 2 .5 2.9-2.5-1.3-2.5 1.3.5-2.9-2.1-2 2.9-.4z" fill="currentColor"/></svg>`;
      case 'heart':
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none">${bgPath}<path d="M12 16.5l-.8-.7c-2.8-2.6-4.7-4.4-4.7-6.5C6.5 7.6 8 6.1 9.7 6.1c1 0 1.9.5 2.3 1.2.4-.7 1.3-1.2 2.3-1.2 1.7 0 3.2 1.5 3.2 3.2 0 2.1-1.9 3.9-4.7 6.5l-.8.7z" fill="currentColor"/></svg>`;
      case 'lock':
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none">${bgPath}<path d="M12 7.5a2.5 2.5 0 0 0-2.5 2.5v1.5H9v5h6v-5h-.5V10a2.5 2.5 0 0 0-2.5-2.5zm1.3 4h-2.6V10a1.3 1.3 0 0 1 2.6 0v1.5z" fill="currentColor"/></svg>`;
      default:
        return '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"></path></svg>';
    }
  }

  export {
    LINK_ICON_DATA_URI,
    RECENT_ICON,
    toolbarIcons,
    getBookmarkIconSrc,
    getFolderSvgIcon
  };
