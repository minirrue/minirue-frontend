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
 * ---------------------------------------------------------------------------
 * Which file, and why there are two
 * ---------------------------------------------------------------------------
 *
 * The other half of #12. Both files are now the cream MiniRue logo — gold
 * "Mini Rue" and sparkle, dark "COSMETICS & PERFUMES", on a cream ground —
 * and these are measurements of the committed files, not guesses:
 *
 *   - `apple-touch-icon.png`: 180px, fully opaque, every corner cream
 *     (246,242,231), mean luminance 230; the mark is the 12% of its pixels
 *     below luminance 200. Until the cream logo replaced every black brand
 *     asset it was a near-black tile (mean 4.8) with a thin white mark.
 *   - `favicon.ico`: the same cream tile with rounded, transparent corners
 *     (corner alpha 0), drawn at 16 and 32 px; opaque pixels mean 228, none
 *     below luminance 96.
 *
 * An opaque tile carries its own ground, so the gold mark reads against a
 * light OR a dark tab strip, which is exactly why iOS home-screen icons are
 * built that way. `media` gives dark chrome the .ico for its native small
 * frames.
 *
 * ORDER MATTERS AND IS DELIBERATE. Safari ignores `media` on icon links and
 * takes the first entry it can use, so the first entry has to be the one that
 * is safe when nobody is choosing — the opaque tile, which is legible on both.
 * The .ico follows, behind an explicit dark-mode query.
 *
 * WHAT WOULD BE BETTER: `apple-touch-icon.png` is 180px and a browser
 * downscales it for a 16px tab, where the .ico has frames drawn at that size.
 * Letting the .ico lead in light chrome as well changes the order pinned
 * here and in its tests, so it is a separate, deliberate change.
 */
export function buildIcons(faviconUrl?: string | null): Metadata['icons'] {
  const committed = [
    /*
     * First, and with no media query, so Safari — which ignores media on icons
     * — lands on the one that works in both chromes.
     */
    {
      url: '/apple-touch-icon.png',
      type: 'image/png',
      sizes: '180x180',
    },
    /*
     * The same cream tile, for dark chrome. Purpose-built 16 and 32 px frames,
     * which is why it stays the dark-mode choice rather than being dropped.
     */
    {
      url: '/favicon.ico',
      sizes: '32x32',
      media: '(prefers-color-scheme: dark)',
    },
    // The large one, for bookmarks, install prompts and anything asking for a
    // high-resolution mark. Also what puts `app/icon.png` back in play at all.
    { url: '/icon.png', type: 'image/png', sizes: '512x512' },
  ];

  return {
    icon: faviconUrl ? [{ url: faviconUrl }, ...committed] : committed,
    apple: '/apple-touch-icon.png',
  };
}
