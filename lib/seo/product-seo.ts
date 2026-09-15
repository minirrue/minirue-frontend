import type { Metadata, MetadataRoute } from 'next';
import type { ApiProduct } from '@/lib/api/catalog';
import { carouselMedia, mediaImageUrl, primaryMedia, productBrand } from '@/lib/api/catalog';
import { productPath } from '@/lib/routes';
import { SITE_URL } from '@/lib/seo/config';
import { clipText, fitSeoTitle, SEO_DESCRIPTION_MAX } from '@/lib/seo/page-seo';

/**
 * Product-page SEO, as pure functions of the API product (#148).
 *
 * Shoppers search "minirue shop <product>", "mini rue shop <product>" and
 * "minirueshop <product>". The title and meta description are the strongest
 * on-page text a result is matched on, so each carries the three spellings
 * ONCE, in a phrase a person would actually write: "MiniRue (Mini Rue)" and
 * the domain handle "minirueshop". Nothing is repeated, so it is not stuffing.
 */

/** Google truncates meta descriptions at roughly this many characters. */
export const PRODUCT_DESCRIPTION_MAX = SEO_DESCRIPTION_MAX;

const BRAND_PHRASE = 'MiniRue (Mini Rue)';
const DESCRIPTION_TAIL = 'Shop at minirueshop.com.';

/** The product brand, unless the product name already starts with it. */
function distinctBrand(p: ApiProduct): string | null {
  const brand = productBrand(p)?.trim();
  if (!brand) return null;
  return p.name.toLowerCase().startsWith(brand.toLowerCase()) ? null : brand;
}

/**
 * "Name — Brand | MiniRue (Mini Rue) · minirueshop" when it fits 60 characters,
 * else the longest shorter form (#155): the "· minirueshop" handle goes first,
 * then "(Mini Rue)", then the product brand. The description always carries
 * every spelling and the brand, so nothing the title drops is lost to search.
 * Used as an ABSOLUTE title, because the root layout template would otherwise
 * append its own "| MiniRue (Mini Rue)" suffix after this one.
 */
export function productSeoTitle(p: ApiProduct): string {
  const brand = distinctBrand(p);
  return fitSeoTitle(brand ? [`${p.name} — ${brand}`, p.name] : [p.name]);
}

function plainText(s: string | undefined): string {
  return (s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

const clip = clipText;

/**
 * "{Product} by {Brand} at MiniRue (Mini Rue). {Description…} Shop at
 * minirueshop.com." The lead and the tail are fixed. The product's own
 * description fills whatever room is left under PRODUCT_DESCRIPTION_MAX and
 * is dropped when too little room is left for it to say anything.
 */
export function productSeoDescription(p: ApiProduct): string {
  const brand = distinctBrand(p);
  const lead = `${p.name}${brand ? ` by ${brand}` : ''} at ${BRAND_PHRASE}.`;
  const body = plainText(p.description);
  const room = PRODUCT_DESCRIPTION_MAX - lead.length - DESCRIPTION_TAIL.length - 2;
  if (!body || room < 24) return `${lead} ${DESCRIPTION_TAIL}`;

  let excerpt = body.charAt(0).toUpperCase() + body.slice(1);
  excerpt = clip(excerpt, room);
  if (!/[.!?…]$/.test(excerpt)) excerpt = `${excerpt}.`;
  // Adding the full stop can push an exactly-fitting excerpt one over.
  if (excerpt.length > room) excerpt = clip(excerpt.slice(0, -1), room);
  return `${lead} ${excerpt} ${DESCRIPTION_TAIL}`;
}

/** Every product-level gallery image, cover first, as absolute URLs. */
export function productImageUrls(p: ApiProduct): string[] {
  const urls = carouselMedia(p)
    .map((m) => mediaImageUrl(m, { w: 1200, h: 1200 }))
    .filter((u): u is string => !!u);
  return [...new Set(urls)];
}

export function buildProductMetadata(p: ApiProduct): Metadata {
  const media = primaryMedia(p);
  const imgUrl = media ? mediaImageUrl(media, { w: 1200, h: 1200 }) ?? undefined : undefined;
  const title = productSeoTitle(p);
  const description = productSeoDescription(p);
  const path = productPath(p);
  return {
    title: { absolute: title },
    description,
    alternates: {
      // Always the product's OWN category, never the one in the URL: a request
      // under the wrong category is redirected by the page.
      canonical: path,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'MiniRue',
      url: `${SITE_URL}${path}`,
      ...(imgUrl ? { images: [{ url: imgUrl, width: 1200, height: 1200, alt: p.name }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imgUrl ? [imgUrl] : [],
    },
  };
}

/** A sitemap row for one product, with lastmod from the product's updatedAt. */
export function productSitemapEntry(p: ApiProduct): MetadataRoute.Sitemap[number] {
  const updated = p.updatedAt ? new Date(p.updatedAt) : null;
  return {
    url: `${SITE_URL}${productPath(p)}`,
    lastModified: updated && !Number.isNaN(updated.getTime()) ? updated : new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  };
}
