import type { ApiProduct, Category } from '@/lib/api/catalog';
import { productBrand, productInStock } from '@/lib/api/catalog';
import { formatMoney } from '@/lib/format/money';
import { COLLAB_ROOT, SHOP_ALL, SHOP_ROOT, categoryPath, productPath } from '@/lib/routes';
import { SITE_URL } from '@/lib/seo/config';

/**
 * /llms.txt and /llms-full.txt (#150), as pure functions of the live catalog.
 *
 * Format: https://llmstxt.org — an H1 with the site name, a blockquote
 * summary, free paragraphs, then H2 sections of `- [name](url): notes` links.
 * AI assistants (ChatGPT, Claude, Perplexity) read this file to learn what the
 * shop sells without executing any JavaScript.
 *
 * Canonical URLs come from `productPath`, the same helper the sitemap and the
 * product metadata (#148) use, so no assistant is handed a URL Google is not.
 */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** A product description as one line of plain text: no tags, no entities. */
export function plainDescription(html: string | undefined): string {
  return (html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
      }
      return ENTITIES[code.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, ' ')
    // A closing tag right before punctuation left "shampoo ." behind.
    .replace(/ ([.,;:!?])/g, '$1')
    .trim();
}

/** "EGP 850", or "from EGP 900" when active sizes are priced differently. */
function priceText(p: ApiProduct): string {
  const active = (p.variants ?? []).filter((v) => v.isActive);
  if (!active.length) return 'Price unavailable';
  const amounts = active.map((v) => parseFloat(v.priceAmount)).filter(Number.isFinite);
  if (!amounts.length) return 'Price unavailable';
  const min = Math.min(...amounts);
  const cheapest = active.find((v) => parseFloat(v.priceAmount) === min) ?? active[0];
  // Intl separates the code with a no-break space; plain text wants a space.
  const money = formatMoney(min, cheapest.priceCurrency).replace(/\s/g, ' ');
  return new Set(amounts).size > 1 ? `from ${money}` : money;
}

function availabilityText(p: ApiProduct): string {
  if (!(p.variants ?? []).some((v) => v.isActive)) return 'Unavailable';
  return productInStock(p) ? 'In stock' : 'Out of stock';
}

/** One `- [Name](url): Brand · EGP 850 · In stock` line, plus the description when full. */
export function llmsProductLine(p: ApiProduct, opts: { withDescription?: boolean } = {}): string {
  const brand = productBrand(p)?.trim();
  const notes = [brand, priceText(p), availabilityText(p)].filter(Boolean).join(' · ');
  const line = `- [${p.name}](${SITE_URL}${productPath(p)}): ${notes}`;
  if (!opts.withDescription) return line;
  const description = plainDescription(p.description);
  return description ? `${line}\n  ${description}` : line;
}

export interface LlmsTxtInput {
  products: ApiProduct[];
  categories: Category[];
  /** true for /llms-full.txt: each product also carries its description. */
  full?: boolean;
}

export function buildLlmsTxt({ products, categories, full = false }: LlmsTxtInput): string {
  const out: string[] = [
    '# MiniRue',
    '',
    '> MiniRue (also written Mini Rue, or minirueshop) is an online store in Egypt selling original-quality perfumes and beauty products, with prices in Egyptian pounds (EGP).',
    '',
    'Website: ' + SITE_URL,
    '',
    'Delivery: Egypt only. MiniRue does not ship outside Egypt; the delivery fee depends on the governorate.',
    'Currency: all prices are in Egyptian pounds (EGP).',
    'Payment: cash on delivery (COD) or InstaPay.',
    'Prices below are regular prices; a sitewide offer may lower them at checkout. Availability is live at the time this file was generated.',
    '',
    '## Shop',
    '',
    `- [Shop](${SITE_URL}${SHOP_ROOT}): the store front door`,
    `- [All products](${SITE_URL}${SHOP_ALL}): the full catalog`,
    ...categories.map((c) => `- [${c.name}](${SITE_URL}${categoryPath(c.slug)})`),
    `- [Collaborations](${SITE_URL}${COLLAB_ROOT}): partner brands sold on MiniRue`,
    '',
    '## Products',
    '',
    ...(products.length
      ? products.map((p) => llmsProductLine(p, { withDescription: full }))
      : ['- No products are listed right now.']),
    '',
    '## Optional',
    '',
    full
      ? `- [llms.txt](${SITE_URL}/llms.txt): the same list without descriptions`
      : `- [llms-full.txt](${SITE_URL}/llms-full.txt): the same list with each product's full description`,
    `- [Sitemap](${SITE_URL}/sitemap.xml)`,
    '',
  ];
  return out.join('\n');
}
