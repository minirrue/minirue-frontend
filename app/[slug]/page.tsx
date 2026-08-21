import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { connection } from 'next/server';
import StorefrontPageView from '@/components/storefront/StorefrontPageView';
import { fetchSpace, fetchStorefrontPage } from '@/lib/api/storefront';
import { stripMarkdown } from '@/lib/storefront/strip-markdown';
import { spacePath } from '@/lib/routes';

/**
 * Admin-authored pages: /terms, /shipping, /about.
 *
 * This route used to serve TWO things — a partner's shop AND a page — because
 * partners lived at the root too. They moved to /collab/{slug} on 2026-08-21
 * (owner: "it should be all under /collab/brandslug"), so the only thing left
 * here is the shop's own pages, and the root namespace is no longer shared.
 *
 * The space lookup stays, purely to REDIRECT. Partner addresses have been
 * shared in messages, printed, and indexed by Google; dropping them would turn
 * every one of those into a 404. A permanent redirect keeps them working and
 * tells search engines where the page went, so the ranking follows rather than
 * being split across two URLs.
 *
 * Ordering matters and is deliberate: the space is checked FIRST. The backend
 * guards the root namespace in both directions (minirue-backend@0.48.0), so a
 * collision cannot exist today — but if one ever did, forwarding a partner to
 * their own page beats rendering an unrelated document at their address.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  const page = await fetchStorefrontPage(slug).catch(() => null);
  if (page) {
    return {
      title: `${page.title} — MiniRue`,
      description: stripMarkdown(page.body).slice(0, 150),
      alternates: { canonical: `/${slug}` },
    };
  }

  // A space resolves here only to be redirected, so it gets no metadata of its
  // own — /collab/{slug} owns its title, description and canonical.
  return { title: 'Page not found' };
}

export default async function StorefrontSlugPage({ params }: PageProps) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  await connection();

  // Caught, unlike the space fetch on the collab route. There, a failing API
  // must surface as an error rather than a 404, because that page has nothing
  // else to be. Here it is a lookup on the way to a page: if the space check
  // fails we simply carry on and try the page, which is the far likelier thing
  // to be at a root-level address now.
  const space = await fetchSpace(slug).catch(() => null);
  if (space) permanentRedirect(spacePath(slug));

  const page = await fetchStorefrontPage(slug);
  if (!page) notFound();
  return <StorefrontPageView title={page.title} body={page.body} />;
}
