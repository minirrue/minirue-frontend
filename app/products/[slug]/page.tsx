import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { catalog, primaryMedia, mediaImageUrl } from '@/lib/api/catalog';
import { getQueryClient } from '@/lib/hooks/query-client';
import { productBySlugQueryOptions } from '@/lib/hooks/queries';
import ProductPageClient from './ProductPageClient';
import ProductSchema from '@/components/seo/ProductSchema';
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema';
import FooterWithSettings from '@/components/layout/FooterWithSettings';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const p = await catalog.getProductBySlug(slug);
    const media = primaryMedia(p);
    const imgUrl = media ? mediaImageUrl(media, { w: 1200, h: 1200 }) ?? undefined : undefined;
    return {
      title: `${p.name} — ${p.brand}`,
      description: p.tagline ?? p.description ?? `${p.name} by ${p.brand}`,
      alternates: {
        canonical: `/products/${slug}`,
      },
      openGraph: {
        title: p.name,
        description: p.tagline ?? p.description,
        type: 'website',
        siteName: 'MiniRue',
        url: `https://minirueshop.com/products/${slug}`,
        ...(imgUrl ? { images: [{ url: imgUrl, width: 1200, height: 1200, alt: p.name }] } : {}),
      },
      twitter: {
        card: 'summary_large_image',
        title: p.name,
        description: p.tagline ?? p.description,
        images: imgUrl ? [imgUrl] : [],
      },
    };
  } catch {
    return { title: 'Product not found' };
  }
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const queryClient = getQueryClient();

  // Blocking prefetch — critical for SEO, want data in the initial HTML
  await queryClient.prefetchQuery(productBySlugQueryOptions(slug));

  let p;
  try {
    p = await catalog.getProductBySlug(slug);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404 || !status) notFound();
    notFound();
  }
  const apiProductJson = JSON.stringify(p);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductSchema slug={slug} productName={p!.name} apiProductJson={apiProductJson} />
      <BreadcrumbSchema productName={p!.name} productSlug={slug} />
      <ProductPageClient slug={slug} apiProductJson={apiProductJson} />
      <FooterWithSettings />
    </HydrationBoundary>
  );
}
