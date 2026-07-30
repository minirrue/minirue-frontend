import type { Metadata } from 'next';
import { connection } from 'next/server';
import { catalog } from '@/lib/api/catalog';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import HeaderWrapper from '@/app/products/HeaderWrapper';
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

  return (
    <>
      <div className="mr-page-sheet">
        <AnnouncementBar />
        <HeaderWrapper />
        <CategoriesGrid categories={topLevel} />
      </div>
      <FooterWithSettings />
    </>
  );
}
