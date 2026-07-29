/**
 * Search-term normalisation — the single definition of "the same search".
 *
 * Without this, `?q=Dior`, `?q=dior` and `?q=dior%20%20` are three URLs with
 * byte-identical content, each canonicalising to itself. That is not one page
 * ranking; it is three pages splitting the same signals and Google keeping
 * whichever it happened to crawl first.
 *
 * Used by both the page's canonical tag and the sitemap, so the URL we submit
 * is always the URL we point at.
 */

/** Longer than this is not a shopper searching, it is a bot or a paste. */
export const MAX_SEARCH_TERM_LENGTH = 80;

/** Below this the backend cannot rank meaningfully and we do not ask it to. */
export const MIN_SEARCH_TERM_LENGTH = 2;

/**
 * The canonical form of a search term: trimmed, inner whitespace collapsed,
 * lowercased. Lowercasing is safe because the backend match is already
 * case-insensitive (`plainto_tsquery` + `ILIKE`), so the normalised term
 * returns exactly the same products as the raw one.
 */
export function normalizeSearchTerm(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Whether a normalised term is worth putting in a search engine's index at all.
 * Length alone is not enough — `?q=...` and `?q=%20-%20` are within bounds and
 * are still nothing, so a term must contain at least one letter or digit.
 */
export function isIndexableSearchTerm(term: string): boolean {
  if (term.length < MIN_SEARCH_TERM_LENGTH) return false;
  if (term.length > MAX_SEARCH_TERM_LENGTH) return false;
  return /[\p{L}\p{N}]/u.test(term);
}

/** The one URL a given search is allowed to live at. */
export function searchCanonicalPath(term: string): string {
  const normalized = normalizeSearchTerm(term);
  return normalized ? `/search?q=${encodeURIComponent(normalized)}` : '/search';
}
