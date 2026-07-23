import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import HeaderWrapper from '@/app/products/HeaderWrapper';
import Markdown from '@/components/storefront/Markdown';
import { fetchStorefrontPage } from '@/lib/api/storefront';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Strips Markdown syntax down to plain text for a meta description. */
function stripMarkdown(body: string): string {
  return body
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^-\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchStorefrontPage(slug);
  if (!page) {
    return { title: 'Page not found' };
  }
  const description = stripMarkdown(page.body).slice(0, 150);
  return {
    title: `${page.title} — MiniRue`,
    description,
    alternates: {
      canonical: `/pages/${slug}`,
    },
  };
}

export default async function ConstantPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await fetchStorefrontPage(slug);
  if (!page) {
    notFound();
  }

  return (
    <div className="mr-page-sheet">
      <AnnouncementBar />
      <HeaderWrapper />

      <main
        style={{
          maxWidth: 'var(--mr-content-max)',
          margin: '0 auto',
          padding: 'clamp(48px,8vw,96px) var(--mr-gutter)',
        }}
      >
        <article>
          <h1
            style={{
              fontFamily: 'var(--mr-font-serif)',
              fontWeight: 400,
              fontSize: 'clamp(var(--mr-text-2xl), 4vw, var(--mr-text-3xl))',
              lineHeight: 1.08,
              letterSpacing: '-0.006em',
              margin: '0 0 clamp(28px, 5vw, 44px)',
              color: 'var(--mr-fg)',
              textAlign: 'center',
            }}
          >
            {page.title}
          </h1>
          <Markdown body={page.body} />
        </article>
      </main>

      <FooterWithSettings />
    </div>
  );
}
