import type { Metadata } from 'next';

/**
 * The site's icons, as a LIST rather than one entry (#12).
 *
 * Two things about Next that this was quietly relying on being untrue:
 *
 *   - setting `metadata.icons` at all overrides the `app/icon.*` FILE
 *     convention, so `app/icon.png` (512px) had been inert — naming it here is
 *     what puts it back in play
 *   - a browser takes the first entry it can use, so order IS priority
 *
 * `app/layout.tsx` used to assign the whole object when a favicon was
 * configured in the dashboard:
 *
 *     metadata.icons = { icon: favicon, apple: "/apple-touch-icon.png" };
 *
 * which left the site with exactly one icon, at one size, with nothing behind
 * it. A bad upload, a dead link or an expired signed URL then had no fallback
 * in any browser at any size. The committed files are the floor; a configured
 * icon sits on top of it rather than replacing it.
 *
 * Lives here rather than inline in the layout so it can be tested without
 * importing the layout's whole module graph — which pulls in ESM-only packages
 * jest cannot parse.
 *
 * This says nothing about WHICH mark is right. That is the other half of #12
 * and needs someone who can see the live setting.
 */
export function buildIcons(faviconUrl?: string | null): Metadata['icons'] {
  const committed = [
    // Small first, for the tab strip.
    { url: '/favicon.ico', sizes: '32x32' },
    { url: '/icon.png', type: 'image/png', sizes: '512x512' },
  ];

  return {
    icon: faviconUrl ? [{ url: faviconUrl }, ...committed] : committed,
    apple: '/apple-touch-icon.png',
  };
}
