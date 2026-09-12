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
 * Which mark, and why there are two
 * ---------------------------------------------------------------------------
 *
 * The other half of #12, measured against the live site rather than guessed.
 *
 * The issue said "black mark invisible on dark browser chrome — use the white
 * version". The premise is INVERTED: `favicon.ico` has **zero pixels below
 * luminance 96** (histogram of its 32x32 frame, opaque pixels only; mean 228,
 * corner alpha 0). It is already a near-white mark on transparency — so it
 * disappears against a LIGHT tab strip, which is the default in Chrome, Safari
 * and Firefox on a light desktop theme.
 *
 * `apple-touch-icon.png` is its opposite and its answer: a fully opaque, near
 * black tile (mean luminance 4.8) with a small light mark on it — 1.5% of its
 * pixels above luminance 159. A solid tile reads against either chrome, which
 * is exactly why iOS home-screen icons are built that way.
 *
 * So both marks already exist, and each is right for one chrome. `media` picks
 * between them.
 *
 * ORDER MATTERS AND IS DELIBERATE. Safari ignores `media` on icon links and
 * takes the first entry it can use, so the first entry has to be the one that
 * is safe when nobody is choosing — the opaque tile, which is legible on both.
 * The transparent white mark follows, behind an explicit dark-mode query.
 *
 * WHAT WOULD BE BETTER: a purpose-built `.ico` with 16 and 32 px frames on an
 * opaque ground. `apple-touch-icon.png` is 180px and a browser downscales it,
 * and a mark covering 1.5% of the tile is thin at 16px. That needs someone who
 * can author the brand mark; this uses only what the brand already ships, and
 * a faint-but-present icon beats one that vanishes.
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
     * The white mark, for dark chrome, where a near-black tile is the one that
     * disappears. Purpose-built 16 and 32 px frames, which is why it stays the
     * dark-mode choice rather than being dropped.
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
