import type { Metadata } from 'next';

/**
 * `page.tsx` in this directory is `'use client'` (it holds interactive design-system
 * demos), and Next.js does not allow a Client Component to export `metadata` — the
 * build fails if you try. This layout is the standard workaround: a plain Server
 * Component sibling that carries the metadata export for the route below it.
 *
 * `robots: 'noindex, nofollow'` is belt-and-braces with the `disallow` entry in
 * `app/robots.ts`: `Disallow` only stops crawling, it does not deindex a URL that
 * search engines already have. `noindex` is what actually keeps this design
 * kitchen-sink page out of results.
 */
export const metadata: Metadata = {
  robots: 'noindex, nofollow',
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
