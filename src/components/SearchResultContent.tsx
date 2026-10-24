import { t } from '../lib/i18n.ts';
import { revealBookmark } from '../lib/reveal-bookmark.ts';
import type { SearchResult } from '../lib/search.ts';

export function SearchResultContent({ result }: { result: SearchResult }) {
  const path = result.folderPath.join(' / ') || t('common_bookmarks');
  return (
    <>
      <span className="search-result-text">
        <span className="node-title">{result.title || result.url}</span>
        <span className="search-result-path" title={path}>
          {!result.url && <span className="search-result-kind">{t('search_folder')} · </span>}
          {path}
        </span>
      </span>
      <button
        type="button"
        className="search-reveal-btn"
        title={t('search_show_in_folder')}
        aria-label={`${t('search_show_in_folder')}: ${result.title || result.url}`}
        onClick={(event) => {
          event.stopPropagation();
          revealBookmark(result.id);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
        }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M3 7V5h6l2 2h10v13H3z" />
          <path d="M7 13h10m-4-4 4 4-4 4" />
        </svg>
      </button>
    </>
  );
}
