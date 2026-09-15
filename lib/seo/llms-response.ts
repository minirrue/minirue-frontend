import { catalog, type ApiProduct } from '@/lib/api/catalog';
import { buildLlmsTxt } from '@/lib/seo/llms';

/** About an hour: fresh enough for prices and stock, cheap for the API. */
export const LLMS_REVALIDATE_SECONDS = 3600;

/** Every product the public catalog lists (it lists published products only). */
async function allProducts(): Promise<ApiProduct[]> {
  const products: ApiProduct[] = [];
  let cursor: string | undefined;
  // Bounded, so a cursor bug in the API can never loop forever.
  for (let page = 0; page < 20; page++) {
    const res = await catalog.listProducts({ limit: 1000, cursor, revalidate: LLMS_REVALIDATE_SECONDS });
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
      catalog.listCategories({ revalidate: LLMS_REVALIDATE_SECONDS }),
    ]);
    return new Response(buildLlmsTxt({ products, categories, full }), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': `public, s-maxage=${LLMS_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
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
