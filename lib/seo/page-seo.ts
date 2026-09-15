import type { Bundle } from '@/lib/api/bundles';
import { SITE_URL } from '@/lib/seo/config';

/**
 * Page-level SEO helpers shared by the product, set, category, partner and
 * listing pages (#155).
 */

/** Google truncates titles past roughly this many characters. */
export const SEO_TITLE_MAX = 60;

/** Google truncates meta descriptions at roughly this many characters. */
export const SEO_DESCRIPTION_MAX = 155;

/**
 * The brand suffixes a title may close with, longest first. All three brand
 * spellings (#148) live in the first one; a shorter one is used only when the
 * page name leaves no room, and the page's meta description then carries the
 * spellings the title had to drop.
 */
export const TITLE_SUFFIXES = [
  ' | MiniRue (Mini Rue) · minirueshop',
  ' | MiniRue (Mini Rue)',
  ' | MiniRue',
] as const;

/**
 * The longest title that fits SEO_TITLE_MAX. `heads` are the page-name
 * variants to try, richest first (e.g. "Name — Brand", then "Name"); each is
 * tried with every suffix before the next head, so the page's own words are
 * kept over the longer brand phrase. When nothing fits, the last head with
 * the shortest suffix: the name always leads and a brand spelling always
 * closes, even if that runs long.
 */
export function fitSeoTitle(heads: readonly string[]): string {
  const names = heads.map((h) => h.trim()).filter(Boolean);
  for (const head of names) {
    for (const suffix of TITLE_SUFFIXES) {
      const title = `${head}${suffix}`;
      if (title.length <= SEO_TITLE_MAX) return title;
    }
  }
  const last = names.at(-1) ?? 'MiniRue';
  return `${last}${TITLE_SUFFIXES[TITLE_SUFFIXES.length - 1]}`;
}

/** Cuts `text` to at most `max` characters at a word boundary, ending in "…". */
export function clipText(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const atWord = cut.slice(0, Math.max(cut.lastIndexOf(' '), 0)) || cut;
  return `${atWord.replace(/[\s,;:.—–-]+$/, '')}…`;
}

/** The site-wide share image, for pages with no picture of their own. */
export const SITE_OG_IMAGE = {
  url: `${SITE_URL}/og-image.jpg`,
  width: 1200,
  height: 630,
  alt: 'MiniRue',
} as const;

/**
 * A partner space's meta description. The partner's own words lead; a short
 * tagline ("Delicate. Elegant. Helia") is not a snippet on its own, so under
 * 50 characters it is followed by a sentence naming the partner and the shop.
 */
export function spaceSeoDescription(name: string, own: string | null | undefined): string {
  const text = (own ?? '').replace(/\s+/g, ' ').trim();
  if (text.length >= 50) return clipText(text, SEO_DESCRIPTION_MAX);
  const lead = text && !/[.!?…]$/.test(text) ? `${text}.` : text;
  return [lead, `Shop ${name} at MiniRue (Mini Rue), in their own space on minirueshop.com.`]
    .filter(Boolean)
    .join(' ');
}

/**
 * A set's meta description: it names the set (the audit requires it), says
 * what is in it, and keeps the brand spellings, within SEO_DESCRIPTION_MAX.
 */
export function bundleSeoDescription(b: Pick<Bundle, 'name' | 'description' | 'members'>): string {
  const pieces = b.members.length;
  const lead = `${b.name} at MiniRue (Mini Rue)${pieces > 1 ? `: ${pieces} pieces, priced as one set` : ''}.`;
  const tail = 'Shop at minirueshop.com.';
  const body = (b.description ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const room = SEO_DESCRIPTION_MAX - lead.length - tail.length - 2;
  if (!body || room < 24) return clipText(`${lead} ${tail}`, SEO_DESCRIPTION_MAX);
  let excerpt = clipText(body, room);
  if (!/[.!?…]$/.test(excerpt)) excerpt = `${excerpt}.`;
  if (excerpt.length > room) excerpt = clipText(excerpt.slice(0, -1), room);
  return `${lead} ${excerpt} ${tail}`;
}
