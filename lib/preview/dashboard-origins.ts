/**
 * Who may frame the draft preview, and whose messages it will accept (#193).
 *
 * ONE list serves both jobs, on purpose: `next.config.ts` turns it into the
 * route's CSP `frame-ancestors`, and the preview page checks every incoming
 * `postMessage`'s `event.origin` against it. Two lists could drift, and a
 * drift in either direction is a bug: a framing origin whose messages are
 * ignored shows "Waiting for the editor…" forever; an accepted origin that
 * cannot frame the page is an allowance nothing uses.
 *
 * No imports and no `@/` alias: `next.config.ts` loads this file too, and it
 * is compiled outside the app's module graph.
 */

/** The route. `app/%5Finternal/…` because a plain `_internal` folder is private and never routed. */
export const DRAFT_PREVIEW_PATH = '/_internal/draft-preview';

/** The dashboard in production, and the dashboard's dev server. */
export const DEFAULT_DASHBOARD_ORIGINS: readonly string[] = [
  'https://dashboard.minirueshop.com',
  'http://localhost:3021',
];

/**
 * The defaults plus any extra origins from a comma-separated env value.
 *
 * Each extra entry must be a bare http(s) ORIGIN (scheme://host[:port], no
 * path, no query) or it is dropped. This is not tidiness: the value is
 * written into a CSP header, and an entry like `https://x; script-src *`
 * would otherwise inject a directive.
 */
export function parseDashboardOrigins(extra: string | undefined): string[] {
  const out = new Set<string>(DEFAULT_DASHBOARD_ORIGINS);
  for (const raw of (extra ?? '').split(',')) {
    const candidate = raw.trim().replace(/\/+$/, '');
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      const isHttp = url.protocol === 'https:' || url.protocol === 'http:';
      if (isHttp && url.origin === candidate) out.add(url.origin);
    } catch {
      // Not a URL at all — dropped, see above.
    }
  }
  return [...out];
}

/**
 * The effective list. `process.env.NEXT_PUBLIC_DASHBOARD_ORIGINS` is written
 * out literally so Next inlines it into the client bundle at build time; the
 * same build-time value feeds the header in `next.config.ts`.
 */
export function dashboardOrigins(): string[] {
  return parseDashboardOrigins(process.env.NEXT_PUBLIC_DASHBOARD_ORIGINS);
}
