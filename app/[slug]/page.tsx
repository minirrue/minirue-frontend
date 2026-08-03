import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import StorefrontPageView from '@/components/storefront/StorefrontPageView';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import CollectionSchema from '@/components/seo/CollectionSchema';
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema';
import SpaceOrganizationSchema from '@/components/seo/SpaceOrganizationSchema';
import { SITE_URL } from '@/lib/seo/config';
import HeaderWrapper from '@/app/products/HeaderWrapper';
import SpaceView from './SpaceView';
import { fetchSpace, fetchStorefrontPage } from '@/lib/api/storefront';
import { apiGetPublicSettings } from '@/lib/api/settings';
import { stripMarkdown } from '@/lib/storefront/strip-markdown';

/**
 * Two different things live at minirueshop.com/<slug>:
 *
 *   /helia   — a partner's own shop (a "space")
 *   /terms   — an admin-authored page
 *
 * Static segments (/products, /cart, /account, …) still win over this dynamic
 * route, so it only catches slugs Next has no real route for.
 *
 * A space is tried first. Collisions are impossible by construction — the
 * backend guards the whole root namespace in both directions since
 * minirue-backend@0.48.0, so a page cannot take `helia` and a partner cannot
 * take `terms` — and if a partner ever did vanish, 404ing is far better than
 * silently rendering an unrelated page under their address.
 */
/**
 * Rendered per request, never prerendered.
 *
 * `connection()` alone was not enough: the page served correct HTML — the H1
 * and the space description are in it — and the browser showed header and
 * footer with nothing between, which is React discarding a server tree it
 * could not reconcile. Same failure the deleted /brands/[brand] page hit
 * ("Couldn't find all resumable slots by key/index during replaying"), and the
 * reason cacheComponents is off for this app. force-dynamic takes the shell
 * out of the equation entirely rather than relying on opting out inside it.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  const space = await fetchSpace(slug).catch(() => null);
  if (space) {
    const description =
      space.space.description?.trim() || `Shop ${space.space.name} at MiniRue.`;
    return {
      title: `${space.space.name} — MiniRue`,
      description,
      // The reason the address is /helia and not /brands/helia: a root-level
      // path is what makes a search for the partner's own name land here.
      alternates: { canonical: `/${slug}` },
      openGraph: {
        title: `${space.space.name} | MiniRue`,
        description,
        type: 'website',
      },
    };
  }

  const page = await fetchStorefrontPage(slug).catch(() => null);
  if (page) {
    return {
      title: `${page.title} — MiniRue`,
      description: stripMarkdown(page.body).slice(0, 150),
      alternates: { canonical: `/${slug}` },
    };
  }

  return { title: 'Page not found' };
}

export default async function StorefrontSlugPage({ params }: PageProps) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  // Opt out of the partially-prerendered shell. On the old brand page the
  // resumed tree never matched the stored shell, so React discarded the server
  // HTML and the page rendered blank — same risk here, same fix. See the note
  // in app/products/[slug]/page.tsx.
  await connection();

  // Deliberately NOT caught. A failing API used to be swallowed into `null`
  // here, fall through to the page lookup, and 404 — so a broken endpoint and
  // a genuinely missing space looked identical, and the page just went blank.
  // Let it throw: an error page naming the cause beats silence.
  const space = await fetchSpace(slug);

  if (space) {
    let storefrontAnnouncement = null as
      | Awaited<ReturnType<typeof apiGetPublicSettings>>['storefront']
      | null;
    try {
      const settings = await apiGetPublicSettings();
      storefrontAnnouncement = settings.storefront;
    } catch {
      /* AnnouncementBar has its own defaults */
    }

    // Mirrors SpaceView's own base/brandTiles logic exactly, so the ItemList
    // never claims a URL the visible page itself doesn't link to: a partner
    // brand tile links inside its own space (`/{space}/{brand}`); a HOUSE
    // space's brand tile links to the scoped `/products?brandId=` listing
    // instead, since a house brand has no page of its own. The space's own
    // no-brand bucket (`isGeneric`) is never a brand tile — see SpaceView.
    const spaceBase = space.space.kind === 'HOUSE' ? '' : `/${space.space.slug}`;
    const spaceBrandTiles = space.brands.filter((b) => !b.isGeneric);

    return (
      <>
        {/* Mirrors SpaceView's own Breadcrumb exactly: Home / {space}, never
            "Home / Shop / {space}" — a partner space is a peer to the main
            shop, not nested under it, and the visible crumb agrees. */}
        <BreadcrumbSchema trail={[{ name: space.space.name, path: slug }]} />
        {/* A partner's own Organization node — never for a HOUSE space, which
            already has one at ${SITE_URL}/#organization (OrganizationSchema).
            See SpaceOrganizationSchema.tsx for why a second one here would
            compete with it rather than reinforce it. */}
        {space.space.kind === 'PARTNER' && (
          <SpaceOrganizationSchema space={space.space} />
        )}
        <CollectionSchema
          name={space.space.name}
          path={`/${slug}`}
          items={{
            kind: 'brands',
            brands: spaceBrandTiles.map((b) => ({
              name: b.name,
              url:
                space.space.kind === 'HOUSE'
                  ? `${SITE_URL}/products?brandId=${b.id}`
                  : `${SITE_URL}${spaceBase}/${b.slug}`,
              imageUrl: b.imageUrl,
              description: b.description,
            })),
          }}
          // Only a PARTNER space has its own addressable Organization node
          // (SpaceOrganizationSchema, gated the same way just above) — a
          // HOUSE space has none of its own to reference here.
          about={
            space.space.kind === 'PARTNER'
              ? { '@id': `${SITE_URL}/${slug}#organization` }
              : undefined
          }
        />
        <div className="mr-page-sheet">
          <AnnouncementBar
            messages={storefrontAnnouncement?.announcementMessages}
            enabled={storefrontAnnouncement?.announcementEnabled ?? true}
            linkUrl={storefrontAnnouncement?.announcementLinkUrl}
            background={storefrontAnnouncement?.announcementBackground}
          />
          <HeaderWrapper />
          <SpaceView
            space={space.space}
            categories={space.categories}
            brands={space.brands}
            shopPanel={space.shopPanel}
          />
        </div>

        {/* W4a.1: moved outside `.mr-page-sheet` — see StorefrontPageView.tsx
            for why a sticky footer needs this everywhere it renders. */}
        <FooterWithSettings />
      </>
    );
  }

  const page = await fetchStorefrontPage(slug);
  if (!page) notFound();
  return <StorefrontPageView title={page.title} body={page.body} />;
}
