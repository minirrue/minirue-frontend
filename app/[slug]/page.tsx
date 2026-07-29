import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import StorefrontPageView from '@/components/storefront/StorefrontPageView';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
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

    return (
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
        />
        <FooterWithSettings />
      </div>
    );
  }

  const page = await fetchStorefrontPage(slug);
  if (!page) notFound();
  return <StorefrontPageView title={page.title} body={page.body} />;
}
