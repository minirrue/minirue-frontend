import type { Metadata } from 'next';
import DraftPreviewClient from './DraftPreviewClient';

/**
 * `/_internal/draft-preview` — the dashboard Storefront editor's live preview
 * (#193). The folder is `%5Finternal`, not `_internal`: a folder starting
 * with an underscore is private in the App Router and never routed (which is
 * why the kitchen-sink `/_internal/preview` 404s), and `%5F` is the escape
 * Next documents for a URL segment that really starts with one.
 *
 * Only the dashboard may frame it (CSP `frame-ancestors`, next.config.ts) and
 * only the dashboard's messages are accepted (DraftPreviewClient). It fetches
 * no layout of its own: until the editor posts a draft it shows a quiet
 * waiting state, never the live layout dressed up as the draft.
 *
 * `noindex` here and `Disallow` in app/robots.ts, for the same belt-and-braces
 * reason the kitchen-sink route gives: Disallow stops crawling, noindex keeps
 * a known URL out of results.
 */
export const metadata: Metadata = {
  title: 'Storefront preview',
  robots: { index: false, follow: false },
};

export default function DraftPreviewPage() {
  return <DraftPreviewClient />;
}
