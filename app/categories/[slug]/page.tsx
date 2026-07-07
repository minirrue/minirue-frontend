import type { Metadata } from 'next';
import Link from 'next/link';
import { catalog } from '@/lib/api/catalog';
import type { Category } from '@/lib/api/catalog';
import Header from '@/components/layout/Header';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema';
import CategoryClient from './CategoryClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Find a category by slug in a flat+nested tree. */
function findCategory(categories: Category[], slug: string): Category | null {
  for (const c of categories) {
    if (c.slug === slug) return c;
    if (c.children?.length) {
      const found = findCategory(c.children, slug);
      if (found) return found;
    }
  }
  return null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const categories = await catalog.listCategories();
    const cat = findCategory(categories, slug);
    if (cat) {
      return {
        title: `${cat.name} Perfumes`,
        description: `Shop ${cat.name} fragrances at MiniRue.`,
        alternates: {
          canonical: `/categories/${slug}`,
        },
        openGraph: {
          title: `${cat.name} Perfumes | MiniRue`,
          description: `Shop ${cat.name} fragrances at MiniRue.`,
        },
      };
    }
  } catch {
    // API unavailable
  }
  return {
    title: 'Browse Perfumes by Category',
    description: 'Browse fragrances by category at MiniRue.',
    alternates: {
      canonical: `/categories/${slug}`,
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;

  let category: Category | null = null;
  let initialProducts: import('@/lib/api/catalog').ApiProduct[] = [];
  let initialHasMore = false;
  let initialCursor: string | null = null;

  try {
    const [categories, productsRes] = await Promise.all([
      catalog.listCategories(),
      catalog.listProducts({ categoryId: slug, limit: 24 }).catch(() => null),
    ]);
    category = findCategory(categories, slug);
    if (productsRes) {
      initialProducts = productsRes.data;
      initialHasMore = productsRes.meta.hasMore;
      initialCursor = productsRes.meta.cursor;
    }
  } catch {
    // API unavailable — graceful degradation
  }

  const displayName = category?.name ?? slug;

  return (
    <>
      <BreadcrumbSchema productName={displayName} productSlug={`categories/${slug}`} />
      <div className="mr-page-sheet">
        <AnnouncementBar />
        <Header onOpenCart={() => {}} cartCount={0} transparent={false} />

        <main
          style={{
            maxWidth: 'var(--mr-content-max)',
            margin: '0 auto',
            padding: 'clamp(48px,8vw,96px) var(--mr-gutter)',
          }}
        >
          {/* Breadcrumb */}
          <nav
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
            <span style={{ color: 'var(--mr-fg-2)' }}>{displayName}</span>
          </nav>

          {/* Page heading */}
          <div style={{ marginBottom: 'var(--mr-sp-7)' }}>
            <div
              style={{
                fontFamily: 'var(--mr-font-label)',
                fontSize: 'var(--mr-text-xs)',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--mr-fg-3)',
                marginBottom: 'var(--mr-sp-3)',
              }}
            >
              Category
            </div>
            <h1
              style={{
                fontFamily: 'var(--mr-font-serif)',
                fontWeight: 400,
                fontSize: 'clamp(var(--mr-text-2xl), 4vw, var(--mr-text-3xl))',
                lineHeight: 1.08,
                letterSpacing: '-0.006em',
                margin: 0,
                color: 'var(--mr-fg)',
              }}
            >
              {displayName}
            </h1>
          </div>

          <CategoryClient
            categoryId={category?.id ?? slug}
            initialProducts={initialProducts}
            initialHasMore={initialHasMore}
            initialCursor={initialCursor}
          />
        </main>
      </div>
      <FooterWithSettings />
    </>
  );
}
