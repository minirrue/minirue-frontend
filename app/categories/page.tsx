import type { Metadata } from 'next';
import { connection } from 'next/server';
import { catalog } from '@/lib/api/catalog';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import HeaderWrapper from '@/app/products/HeaderWrapper';
import { fetchHouseSpace } from '@/lib/api/storefront';
import { countBundles } from '@/lib/api/bundles';
import CategoriesGrid from './CategoriesGrid';

/**
 * `/categories` — Task AA (owner request 2026-07-30): the mobile nav's Shop
 * tab now opens this instead of the flat `/products` list. "shop button on
 * mobile nav redirects to minirue categories which have their images section
 * on each card better and additional card inside categories is the card
 * which holds all products page."
 *
 * Real top-level categories from the catalogue (`catalog.listCategories()`),
 * never a hardcoded list — that was already fixed elsewhere today and this
 * page must not regress it. Each renders as a card with that category's own
 * image (categories became mandatory-imaged earlier today, so every one has
 * a real photograph, not a placeholder). One extra tile — "All Products" —
 * sits alongside them and leads to `/products`, the flat catalogue.
 *
 * 2026-07-31 owner ask ("brand logo in shop panel... like collab page"):
 * this IS the "shop panel" the bottom nav's Shop tab opens, so MiniRue's own
 * uploaded logo belongs in its header the same way a partner's belongs on
 * their own space page (`app/[slug]/SpaceView.tsx`) — same fetch
 * (`fetchHouseSpace`, the house branch of the identical space-resolution
 * mechanism SpaceView already uses for a partner), same layout (logo beside
 * the title). Not the header: the owner explicitly removed the uploaded logo
 * there minutes earlier because it duplicated the wordmark.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Shop by Category — MiniRue',
  description: 'Browse every MiniRue category, or shop the full catalogue at once.',
  alternates: { canonical: '/categories' },
};

export default async function CategoriesIndexPage() {
  // Opt out of the partially-prerendered shell — same reasoning as every
  // other storefront route (app/brands/page.tsx, app/[slug]/page.tsx).
  await connection();

  let categories: import('@/lib/api/catalog').Category[] = [];
  try {
    categories = await catalog.listCategories();
  } catch {
    // API unavailable — graceful degradation, same as app/categories/[slug].
  }

  // Top-level only: the tree's own children render inside a category's own
  // page (app/categories/[slug]), not flattened into this index.
  const topLevel = categories.filter((c) => c.parentId === null);

  // Best-effort: a house-space fetch failure must not take the whole "Shop"
  // page down — it just renders without a logo, same as SpaceView degrades
  // when a partner's own fetch fails upstream in app/[slug]/page.tsx.
  let shopName: string | null = null;
  let shopLogoUrl: string | null = null;
  try {
    const house = await fetchHouseSpace();
    shopName = house.space.name;
    shopLogoUrl = house.space.logoUrl;
  } catch {
    // No logo this request — CategoriesGrid falls back to the generic icon.
  }

  /**
   * The Bundles tile only exists once there is at least one set to see (owner
   * request, 2026-08-01) — a card leading to an empty page is worse than no
   * card.
   *
   * Fails soft for the same reason the house-space fetch above does: a count
   * that does not answer hides the tile, it never takes the Shop page down.
   * This page is what the phone's Shop tab opens, so it failing is the whole
   * shop failing.
   */
  let bundleCount = 0;
  try {
    bundleCount = await countBundles();
  } catch {
    // No tile this request.
  }

  return (
    <>
      <div className="mr-page-sheet">
        <AnnouncementBar />
        <HeaderWrapper />
        <CategoriesGrid
          categories={topLevel}
          shopName={shopName}
          shopLogoUrl={shopLogoUrl}
          hasBundles={bundleCount > 0}
        />
      </div>
      <FooterWithSettings />
    </>
  );
}
