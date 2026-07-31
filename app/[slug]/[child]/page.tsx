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
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema';
import SpaceCategoryClient from './SpaceCategoryClient';

/**
 * One level inside a partner's shop: `/helia/jewellery`, `/helia/chanel` or
 * `/helia/no-1` — a category, a brand or a product.
 *
 * The URL alone cannot say which it is, so the server decides, in a fixed
 * order: category first, then brand, then product. Categories are few,
 * curated and admin-named; brands are also admin-named but there are more of
 * them; product slugs are numerous and generated — so a collision is likelier
 * to be an accidental product than an accidental brand, and likelier to be an
 * accidental brand than an accidental category. (Task 7, 2026-07-30 —
 * `SpaceView`'s brand tiles link here instead of out to
 * `/products?brand=<name>`, so this route needed a brand branch to resolve
 * to.)
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
  if (!resolved || resolved.kind === 'product') {
    return { title: 'Page not found' };
  }

  const name = resolved.kind === 'category' ? resolved.category.name : resolved.brand.name;
  return {
    title: `${name} — ${resolved.space.name} | MiniRue`,
    description: `Shop ${name} from ${resolved.space.name} at MiniRue.`,
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

  const { space } = resolved;
  // The one thing rendered differently below is which name/id this page is
  // about — a category or a brand. Everything else (header, breadcrumb shell,
  // product grid) is identical, mirroring how the category branch always
  // worked.
  const name = resolved.kind === 'category' ? resolved.category.name : resolved.brand.name;

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
    const res = await catalog.listProducts(
      resolved.kind === 'category'
        ? { categoryId: resolved.category.id, limit: 24 }
        : { brandId: resolved.brand.id, limit: 24 },
    );
    initialProducts = res.data;
    initialHasMore = res.meta.hasMore;
    initialCursor = res.meta.cursor;
  } catch {
    /* graceful empty state — an empty category/brand still renders its header */
  }

  return (
    <>
    {/* Mirrors the visible breadcrumb below exactly: Home / {space} / {name} —
        never "Home / Shop / {space} / {name}"; a space is a peer to the main
        shop, not nested under it. */}
    <BreadcrumbSchema
      trail={[
        { name: space.name, path: space.slug },
        { name, path: `${space.slug}/${child}` },
      ]}
    />
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
        {/* Home / Helia / Jewellery (or / Chanel) — every step real, and true
            for a jewellery house as much as a perfume one. The page this
            replaces printed a hardcoded "Perfumes" above every brand. */}
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
          <span style={{ color: 'var(--mr-fg-2)' }}>{name}</span>
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
          {name}
        </h1>

        <SpaceCategoryClient
          categoryId={resolved.kind === 'category' ? resolved.category.id : undefined}
          brandId={resolved.kind === 'brand' ? resolved.brand.id : undefined}
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
