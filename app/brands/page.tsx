import type { Metadata } from 'next';
import { connection } from 'next/server';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import CollectionSchema from '@/components/seo/CollectionSchema';
import { SITE_URL } from '@/lib/seo/config';
import HeaderWrapper from '@/app/products/HeaderWrapper';
import BrandsGrid from './BrandsGrid';
import { apiListPublicBrands } from '@/lib/api/collaborators';
import { apiGetPublicSettings } from '@/lib/api/settings';

/**
 * `/brands` — an index of every partner space, linking out to `/{slug}`.
 *
 * NOT a revival of the old `/brands/[brand]` page: that page WAS a single
 * brand's storefront and was deleted deliberately when partners moved to
 * root-level spaces (`/helia`, not `/brands/helia` — see `next.config.ts`'s
 * 301 for the old URL shape). This route is new — a picture-and-name index
 * page one level up from those spaces, not a per-brand page itself.
 *
 * Data already exists via `apiListPublicBrands()` (`GET /v1/collab/brands`);
 * no backend endpoint was added for this.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Brands — MiniRue',
  description: 'Every maison and partner atelier selling on MiniRue.',
  alternates: { canonical: '/brands' },
};

export default async function BrandsPage() {
  // Opt out of the partially-prerendered shell — same reasoning as
  // app/[slug]/page.tsx: a resumed tree that doesn't match the stored shell
  // renders a blank page between header and footer.
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
        name="Brands"
        path="/brands"
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
        <BrandsGrid brands={brands} />
      </div>

      {/* Outside `.mr-page-sheet`, same as every other storefront page — a
          sticky footer needs this (see StorefrontPageView.tsx). */}
      <FooterWithSettings />
    </>
  );
}
