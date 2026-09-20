import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { connection } from 'next/server';
import { catalog } from '@/lib/api/catalog';
import { buildProductMetadata } from '@/lib/seo/product-seo';
import { fetchStorefrontChrome, FALLBACK_CHROME } from '@/lib/api/storefront';
import { loadPromiseFacts } from '@/lib/storefront/promise-facts.server';
import ProductPageClient from './ProductPageClient';
import AnnouncementBarServer from '@/components/layout/AnnouncementBarServer';
import ProductSchema from '@/components/seo/ProductSchema';
import BreadcrumbSchema, { SHOP_CRUMB } from '@/components/seo/BreadcrumbSchema';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import { getProductReviewsForSchema } from './product-data';
import { productPath, SHOP_ROOT } from '@/lib/routes';

/**
 * A product lives under its own category: /shop/{category}/{product}.
 *
 * `products.category_id` is NOT NULL, so every product has exactly one
 * category and this path is canonical rather than one of several — which is
 * what makes the URL safe to share and leaves search engines nothing to choose
 * between. The old flat /products/{slug} permanently redirects here.
 */
interface PageProps {
  params: Promise<{ category: string; product: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { product: slug } = await params;
  try {
    const p = await catalog.getProductBySlug(slug);
    // Title, description (with every brand spelling, #148), canonical,
    // OpenGraph and Twitter all come from one pure, tested builder.
    return buildProductMetadata(p);
  } catch {
    return { title: 'Product not found' };
  }
}

export default async function ProductPage({ params }: PageProps) {
  const { category, product: slug } = await params;
  // Opt out of the partially-prerendered shell. With Cache Components this
  // route was prerendered and then "resumed" at request time; the replayed
  // tree never matched the stored one, so React logged "Couldn't find all
  // resumable slots by key/index during replaying", discarded the server HTML
  // and fell back to client rendering — which, behind the root layout's
  // <Suspense fallback={null}>, showed an empty page. Rendering on demand
  // removes the shell, so there is nothing to resume and nothing to mismatch.
  await connection();

  // NOTE: this page deliberately does NOT prefetch into React Query and wrap
  // itself in a HydrationBoundary any more. Nothing here consumed that query —
  // the product is passed to the client as `apiProductJson` — but dehydrate()
  // stamps each entry with Date.now(), which baked a build-time timestamp into
  // the partially-prerendered shell. At request time the replayed tree no
  // longer matched it, so React logged "Couldn't find all resumable slots by
  // key/index during replaying" and threw the server HTML away; with the root
  // layout's <Suspense fallback={null}> that left the whole page blank behind
  // the error boundary. The product data is still fetched below, so the markup
  // is unchanged for SEO.
  let p;
  try {
    p = await catalog.getProductBySlug(slug);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404 || !status) notFound();
    notFound();
  }
  /**
   * One product, one URL.
   *
   * Reaching a real product under the wrong category is a real request — an old
   * link, a mistyped path, a product that has since been recategorised — and
   * rendering it there would quietly create a second address for the same page.
   * Redirecting instead means the shop only ever serves the canonical one.
   * Permanent, because a recategorised product's old path is not coming back.
   */
  const canonical = productPath(p!);
  if (p!.categorySlug && p!.categorySlug !== category) {
    permanentRedirect(canonical);
  }

  const apiProductJson = JSON.stringify(p);

  // Real reviews for the Product schema's `review` entries. A failure here
  // must not take the product page down with it — see product-data.ts.
  const reviews = await getProductReviewsForSchema(p!.id);

  // Fetched here rather than through useStorefrontChrome() in the client so the
  // service promises are in the server-rendered HTML. Read client-side only,
  // they were absent from the SSR markup entirely — worse for crawlers than the
  // hardcoded lines they replaced.
  let perks = FALLBACK_CHROME.productSection.perks;
  try {
    const chrome = await fetchStorefrontChrome();
    perks = chrome.productSection?.perks ?? perks;
  } catch {
    // A chrome fetch failure must not take the product page down with it.
  }

  // The settings each promise is allowed to rest on, read here for the same
  // reason as the perks above: resolved only in the browser, the free-delivery
  // promise reached neither a crawler nor the first paint.
  const promiseFacts = await loadPromiseFacts();

  return (
    <>
      <ProductSchema
        slug={slug}
        productName={p!.name}
        apiProductJson={apiProductJson}
        reviews={reviews}
      />
      {/* A full path, never a bare slug: a bare slug resolves to the live
          partner-space route (/[slug]), so a product breadcrumb built from one
          could hand Google a partner's shop page as this product's parent
          instead of the product's own address. The trail now has a real middle
          rung too — Shop / {category} / {product} — which the flat /products
          scheme could not express. */}
      <BreadcrumbSchema
        trail={[
          SHOP_CRUMB,
          ...(p!.categoryName && p!.categorySlug
            ? [{ name: p!.categoryName, path: `${SHOP_ROOT.slice(1)}/${p!.categorySlug}` }]
            : []),
          { name: p!.name, path: canonical.slice(1) },
        ]}
      />
      <ProductPageClient
        slug={slug}
        apiProductJson={apiProductJson}
        perks={perks}
        promiseFacts={promiseFacts}
        announcement={<AnnouncementBarServer />}
      />

      {/* The footer band — AFTER `ProductPageClient`, which is what renders
          `.mr-page-sheet` on this route. That is where it sat before September
          and where the DOM should read it: the product page first, its footer
          last. It is ordered UNDER the page by `z-index: -1` resolved inside
          `.mr-app-layer` (app/layout.tsx), not by being moved ahead of the page
          in document order the way #48 did — which is also what stops it
          reaching into this page's left column. See
          components/layout/Footer.tsx. */}
      <FooterWithSettings />
    </>
  );
}
