import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { catalog } from '@/lib/api/catalog';
import {
  apiListPublicBrands,
  apiCheckCollaboratorBrandExists,
} from '@/lib/api/collaborators';
import { getQueryClient } from '@/lib/hooks/query-client';
import { productsQueryOptions } from '@/lib/hooks/queries';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import HeaderWrapper from '@/app/products/HeaderWrapper';
import { apiGetPublicSettings } from '@/lib/api/settings';
import BrandSectionClient from './BrandSectionClient';

interface PageProps {
  params: Promise<{ brand: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { brand: brandParam } = await params;
  const slug = decodeURIComponent(brandParam);
  let title = slug;
  try {
    const brands = await apiListPublicBrands();
    const match = brands.find((b) => b.brandSlug === slug || b.brandName === slug);
    if (match) title = match.brandName;
  } catch {
    /* use slug */
  }
  return {
    title,
    description: `Shop fragrances from ${title} at MiniRue.`,
    alternates: {
      canonical: `/brands/${slug}`,
    },
    openGraph: {
      title: `${title} | MiniRue`,
      description: `Shop fragrances from ${title} at MiniRue.`,
    },
  };
}

export default async function BrandPage({ params }: PageProps) {
  const { brand: brandParam } = await params;
  const slug = decodeURIComponent(brandParam);

  const queryClient = getQueryClient();

  let brandName = slug;
  let description: string | null = null;
  let logoUrl: string | null = null;
  let hasPublicBrandMatch = false;

  try {
    const brands = await apiListPublicBrands();
    const match = brands.find((b) => b.brandSlug === slug || b.brandName === slug);
    if (match) {
      brandName = match.brandName;
      description = match.description;
      logoUrl = match.logoUrl;
      hasPublicBrandMatch = true;
    }
  } catch {
    /* catalog filter falls back to slug as brand name */
  }

  /* T021 guard: if slug wasn't in public brands but corresponds to an
     ineligible collaborator, return not-found to prevent data leakage */
  if (!hasPublicBrandMatch) {
    try {
      const exists = await apiCheckCollaboratorBrandExists(slug);
      if (exists) {
        notFound();
      }
    } catch {
      notFound();
    }
  }

  let storefrontAnnouncement = null as Awaited<ReturnType<typeof apiGetPublicSettings>>['storefront'] | null;
  try {
    const settings = await apiGetPublicSettings();
    storefrontAnnouncement = settings.storefront;
  } catch {
    /* defaults in AnnouncementBar */
  }

  // Non‑blocking prefetch — brand products can stream
  void queryClient.prefetchQuery(productsQueryOptions({ brand: brandName, limit: 24 }));

  let initialProducts: import('@/lib/api/catalog').ApiProduct[] = [];
  let initialHasMore = false;
  let initialCursor: string | null = null;

  try {
    const res = await catalog.listProducts({ brand: brandName, limit: 24 });
    initialProducts = res.data;
    initialHasMore = res.meta.hasMore;
    initialCursor = res.meta.cursor;
  } catch {
    // graceful empty state
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
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
          <nav
            data-trace-id="PG-STOREFRONT-CAT-002::EL-REGION-breadcrumb-navigation"
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
            }}
          >
            <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
              Home
            </Link>
            <span>/</span>
            <Link href="/products" style={{ color: 'inherit', textDecoration: 'none' }}>
              Perfumes
            </Link>
            <span>/</span>
            <span style={{ color: 'var(--mr-fg-2)' }}>{brandName}</span>
          </nav>

          <header
            data-trace-id="PG-STOREFRONT-CAT-002::EL-REGION-brand-header"
            style={{ marginBottom: 'var(--mr-sp-7)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--mr-sp-4)', marginBottom: 'var(--mr-sp-4)' }}>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  width={64}
                  height={64}
                  style={{ objectFit: 'contain', borderRadius: 4 }}
                />
              ) : null}
              <div>
            <h1
              style={{
                fontFamily: 'var(--mr-font-serif)',
                fontWeight: 400,
                fontSize: 'clamp(var(--mr-text-2xl), 4vw, var(--mr-text-3xl))',
                lineHeight: 1.08,
                letterSpacing: '-0.006em',
                margin: '0 0 var(--mr-sp-3)',
                color: 'var(--mr-fg)',
                textWrap: 'balance',
              }}
            >
              {brandName}
            </h1>
            <p
              style={{
                fontFamily: 'var(--mr-font-body)',
                fontSize: 'var(--mr-text-base)',
                color: 'var(--mr-fg-2)',
                margin: 0,
                maxWidth: '52ch',
              }}
            >
              {description ?? `Fragrances curated from the ${brandName} collection.`}
            </p>
              </div>
            </div>
          </header>

          <BrandSectionClient
            brand={brandName}
            initialProducts={initialProducts}
            initialHasMore={initialHasMore}
            initialCursor={initialCursor}
          />
        </main>
      </div>
      <FooterWithSettings />
    </HydrationBoundary>
  );
}
