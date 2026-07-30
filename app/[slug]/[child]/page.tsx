import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import Link from 'next/link';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import HeaderWrapper from '@/app/products/HeaderWrapper';
import { fetchSpaceChild } from '@/lib/api/storefront';
import { apiGetPublicSettings } from '@/lib/api/settings';
import { catalog } from '@/lib/api/catalog';
import SpaceCategoryClient from './SpaceCategoryClient';

/**
 * One level inside a partner's shop: `/helia/jewellery` or `/helia/no-1`.
 *
 * The URL alone cannot say which it is, so the server decides. Category wins a
 * tie — categories are few, curated and admin-named, while product slugs are
 * numerous and generated, so a collision is far likelier to be an accidental
 * product than an accidental category.
 *
 * A product resolves to a redirect rather than a second copy of the product
 * page: one product, one canonical URL, no duplicate-content penalty and no
 * second template to keep in step.
 */
interface PageProps {
  params: Promise<{ slug: string; child: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: rawSlug, child: rawChild } = await params;
  const slug = decodeURIComponent(rawSlug);
  const child = decodeURIComponent(rawChild);

  const resolved = await fetchSpaceChild(slug, child).catch(() => null);
  if (!resolved || resolved.kind !== 'category') {
    return { title: 'Page not found' };
  }

  const title = `${resolved.category.name} — ${resolved.space.name}`;
  return {
    title: `${title} | MiniRue`,
    description: `Shop ${resolved.category.name} from ${resolved.space.name} at MiniRue.`,
    alternates: { canonical: `/${slug}/${child}` },
  };
}

export default async function SpaceChildPage({ params }: PageProps) {
  const { slug: rawSlug, child: rawChild } = await params;
  const slug = decodeURIComponent(rawSlug);
  const child = decodeURIComponent(rawChild);

  await connection();

  const resolved = await fetchSpaceChild(slug, child).catch(() => null);
  if (!resolved) notFound();

  // A product keeps its one canonical address under /products.
  if (resolved.kind === 'product') {
    redirect(`/products/${child}`);
  }

  const { space, category } = resolved;

  let storefrontAnnouncement = null as
    | Awaited<ReturnType<typeof apiGetPublicSettings>>['storefront']
    | null;
  try {
    const settings = await apiGetPublicSettings();
    storefrontAnnouncement = settings.storefront;
  } catch {
    /* AnnouncementBar has its own defaults */
  }

  let initialProducts: import('@/lib/api/catalog').ApiProduct[] = [];
  let initialHasMore = false;
  let initialCursor: string | null = null;
  try {
    const res = await catalog.listProducts({ categoryId: category.id, limit: 24 });
    initialProducts = res.data;
    initialHasMore = res.meta.hasMore;
    initialCursor = res.meta.cursor;
  } catch {
    /* graceful empty state — an empty category still renders its header */
  }

  return (
    <>
    <div className="mr-page-sheet">
      <AnnouncementBar
        messages={storefrontAnnouncement?.announcementMessages}
        enabled={storefrontAnnouncement?.announcementEnabled ?? true}
        linkUrl={storefrontAnnouncement?.announcementLinkUrl}
        background={storefrontAnnouncement?.announcementBackground}
      />
      <HeaderWrapper />

      <main
        style={{
          maxWidth: 'var(--mr-content-max)',
          margin: '0 auto',
          padding: 'clamp(48px,8vw,96px) var(--mr-gutter)',
        }}
      >
        {/* Home / Helia / Jewellery — every step real, and true for a
            jewellery house as much as a perfume one. The page this replaces
            printed a hardcoded "Perfumes" above every brand. */}
        <nav
          aria-label="Breadcrumb"
          style={{
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--mr-fg-4)',
            marginBottom: 'var(--mr-sp-6)',
            display: 'flex',
            gap: 'var(--mr-sp-2)',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/${space.slug}`}
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            {space.name}
          </Link>
          <span aria-hidden="true">/</span>
          <span style={{ color: 'var(--mr-fg-2)' }}>{category.name}</span>
        </nav>

        <h1
          style={{
            fontFamily: 'var(--mr-font-serif)',
            fontWeight: 400,
            fontSize: 'clamp(var(--mr-text-2xl), 4vw, var(--mr-text-3xl))',
            lineHeight: 1.08,
            letterSpacing: '-0.006em',
            marginBottom: 'var(--mr-sp-6)',
          }}
        >
          {category.name}
        </h1>

        <SpaceCategoryClient
          categoryId={category.id}
          initialProducts={initialProducts}
          initialHasMore={initialHasMore}
          initialCursor={initialCursor}
        />
      </main>
    </div>

    {/* W4a.1: moved outside `.mr-page-sheet` — see StorefrontPageView.tsx for
        why a sticky footer needs this everywhere it renders. */}
    <FooterWithSettings />
    </>
  );
}
