import { permanentRedirect, notFound } from 'next/navigation';
import { connection } from 'next/server';
import { catalog } from '@/lib/api/catalog';
import { productPath, SHOP_ALL } from '@/lib/routes';

/**
 * The old flat product address, kept ONLY to forward.
 *
 * `/products/{slug}` was the product page until 2026-08-21, when the shop's two
 * front doors (`/products` and `/categories`, the latter titled "Shop") became
 * one and every product moved under its own category — see `lib/routes.ts`.
 * These URLs are indexed, shared and sitting in people's history, so they
 * cannot simply 404.
 *
 * This is a page rather than a `redirects()` entry in next.config because the
 * destination is not derivable from the source: `/shop/{category}/{slug}` needs
 * the product's category, which only a lookup can supply. The rest of the old
 * scheme IS static and does live in next.config.
 *
 * `permanentRedirect` issues a 308, so search engines move their index across
 * and stop asking. If the product cannot be resolved at all we fall through to
 * a 404 rather than dumping the visitor on a listing — a dead product link
 * should say so, not pretend to have found something.
 *
 * Delete this once the old URLs have aged out of the index and the logs stop
 * showing hits.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LegacyProductRedirect({ params }: PageProps) {
  await connection();
  const { slug } = await params;

  let product;
  try {
    product = await catalog.getProductBySlug(slug);
  } catch {
    notFound();
  }

  // No category on the record means the API is older than the field. Sending
  // them to the full listing is a poor answer but a working one, and it cannot
  // loop: /shop/all is a real page that never redirects here.
  if (!product?.categorySlug) permanentRedirect(SHOP_ALL);

  permanentRedirect(productPath(product));
}
