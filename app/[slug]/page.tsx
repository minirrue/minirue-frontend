import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import StorefrontPageView from '@/components/storefront/StorefrontPageView';
import { fetchStorefrontPage } from '@/lib/api/storefront';
import { stripMarkdown } from '@/lib/storefront/strip-markdown';

/**
 * Canonical route for admin-authored pages: minirueshop.com/<slug>, not
 * /pages/<slug>. Static segments (/products, /cart, /account, …) still win over
 * this dynamic one, so it only ever catches slugs Next has no real route for —
 * and 404s when no page owns that slug.
 */
interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchStorefrontPage(slug);
  if (!page) {
    return { title: 'Page not found' };
  }
  return {
    title: `${page.title} — MiniRue`,
    description: stripMarkdown(page.body).slice(0, 150),
    alternates: { canonical: `/${slug}` },
  };
}

export default async function StorefrontSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await fetchStorefrontPage(slug);
  if (!page) notFound();
  return <StorefrontPageView title={page.title} body={page.body} />;
}
