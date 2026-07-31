import type { Metadata } from 'next';
import { connection } from 'next/server';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import CollectionSchema from '@/components/seo/CollectionSchema';
import { SITE_URL } from '@/lib/seo/config';
import HeaderWrapper from '@/app/products/HeaderWrapper';
import CollabGrid from './CollabGrid';
import { apiListPublicBrands } from '@/lib/api/collaborators';
import { apiGetPublicSettings } from '@/lib/api/settings';

/**
 * `/collab` — Task AA (owner request 2026-07-30): "add new icon called collab
 * where it holds all collab minirue holds so customer can directly see the
 * collab we have with minirue." Every partner space, in one grid — logo
 * thumbnail, star rating, number of ratings, and how many products they
 * have — each card linking straight to the partner's own root-level space
 * (`/{slug}`, e.g. `/helia`), never `/brands/<slug>` or `/collab/<slug>`.
 *
 * Same data source as `/brands` (`apiListPublicBrands()` -> `GET
 * /v1/collab/brands`), which already honours `storefrontVisible` and ACTIVE
 * status server-side — a suspended or hidden partner never reaches this
 * page. The rating/product-count fields were added to that one response
 * (minirue-backend `listActivePublicBrands`) rather than fetched per card,
 * so this whole grid is still exactly one request.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Collab — MiniRue',
  description: 'Every maison and partner atelier MiniRue collaborates with.',
  alternates: { canonical: '/collab' },
};

export default async function CollabPage() {
  // Opt out of the partially-prerendered shell — same reasoning as
  // app/brands/page.tsx and app/[slug]/page.tsx.
  await connection();

  const brands = await apiListPublicBrands();

  let storefrontAnnouncement = null as
    | Awaited<ReturnType<typeof apiGetPublicSettings>>['storefront']
    | null;
  try {
    const settings = await apiGetPublicSettings();
    storefrontAnnouncement = settings.storefront;
  } catch {
    /* AnnouncementBar has its own defaults */
  }

  return (
    <>
      <CollectionSchema
        name="Collab"
        path="/collab"
        items={{
          kind: 'brands',
          brands: brands.map((b) => ({
            name: b.brandName,
            url: `${SITE_URL}/${b.brandSlug}`,
            imageUrl: b.logoUrl,
            description: b.description,
          })),
        }}
      />
      <div className="mr-page-sheet">
        <AnnouncementBar
          messages={storefrontAnnouncement?.announcementMessages}
          enabled={storefrontAnnouncement?.announcementEnabled ?? true}
          linkUrl={storefrontAnnouncement?.announcementLinkUrl}
          background={storefrontAnnouncement?.announcementBackground}
        />
        <HeaderWrapper />
        <CollabGrid brands={brands} />
      </div>

      {/* Outside `.mr-page-sheet`, same as every other storefront page — a
          sticky footer needs this (see StorefrontPageView.tsx). */}
      <FooterWithSettings />
    </>
  );
}
