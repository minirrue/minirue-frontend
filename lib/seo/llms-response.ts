import { catalog, type ApiProduct } from '@/lib/api/catalog';
import { buildLlmsTxt } from '@/lib/seo/llms';

/**
 * #152: a product published in the dashboard must reach /llms.txt,
 * /llms-full.txt and /sitemap.xml within FIVE MINUTES, with no deploy.
 *
 * Why time-based caching and not on-demand revalidation (a secret-protected
 * route the backend calls after catalog writes): short windows already meet
 * the owner's bar and have no moving parts. On-demand would add a cross-repo
 * secret, a webhook that can fail silently, and a backend that must remember
 * to call it from every write path; one missed call would leave a product out
 * until the next deploy. The cost here is one catalog read per window per
 * region, against a backend that caches the same endpoints itself (60s,
 * dropped on every product write).
 *
 * Layers stack, so the budget is the SUM, not the largest:
 *   Next Data Cache on the catalog fetch   ≤ 60s  (CATALOG_REVALIDATE_SECONDS)
 * + Vercel CDN fresh copy (s-maxage)       ≤ 180s
 * + one stale serve while it regenerates   ≤ 60s  (stale-while-revalidate)
 * = at most 300s. A long stale-while-revalidate (this was 86400) would break
 * the promise on a quiet site: the first visitor after hours gets the old file.
 * Pinned by __tests__/seo/catalog-freshness.test.ts.
 */
export const CATALOG_REVALIDATE_SECONDS = 60;
const CDN_MAX_AGE_SECONDS = 180;
const CDN_STALE_SECONDS = 60;

/** Every product the public catalog lists (it lists published products only). */
async function allProducts(): Promise<ApiProduct[]> {
  const products: ApiProduct[] = [];
  let cursor: string | undefined;
  // Bounded, so a cursor bug in the API can never loop forever.
  for (let page = 0; page < 20; page++) {
    const res = await catalog.listProducts({ limit: 1000, cursor, revalidate: CATALOG_REVALIDATE_SECONDS });
    products.push(...res.data);
    if (!res.meta.hasMore || !res.meta.cursor) break;
    cursor = res.meta.cursor;
  }
  return products;
}

/**
 * The /llms.txt (or /llms-full.txt) response, built from the live catalog.
 *
 * A failed catalog read answers 503, uncached, instead of a file that says the
 * shop sells nothing: an assistant that caches "no products" is worse than one
 * that retries.
 */
export async function llmsTxtResponse({ full }: { full: boolean }): Promise<Response> {
  try {
    const [products, categories] = await Promise.all([
      allProducts(),
      catalog.listCategories({ revalidate: CATALOG_REVALIDATE_SECONDS }),
    ]);
    return new Response(buildLlmsTxt({ products, categories, full }), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': `public, s-maxage=${CDN_MAX_AGE_SECONDS}, stale-while-revalidate=${CDN_STALE_SECONDS}`,
      },
    });
  } catch (err) {
    console.error(`[llms${full ? '-full' : ''}.txt] catalog read FAILED:`, err);
    return new Response('Catalog temporarily unavailable. Try again shortly.\n', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '300' },
    });
  }
}
