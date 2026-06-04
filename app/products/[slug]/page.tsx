import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { catalog, primaryMedia, cloudinaryUrl } from '@/lib/api/catalog';
import ProductPageClient from './ProductPageClient';
import ProductSchema from '@/components/seo/ProductSchema';
import BreadcrumbSchema from '@/components/seo/BreadcrumbSchema';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const p = await catalog.getProductBySlug(slug);
    const media = primaryMedia(p);
    const imgUrl = media
      ? cloudinaryUrl(media.cloudinaryPublicId, { w: 800, h: 1000 })
      : undefined;
    return {
      title: `${p.name} — ${p.brand} · MiniRue`,
      description: p.tagline ?? p.description ?? `${p.name} by ${p.brand}`,
      openGraph: {
        title: p.name,
        description: p.tagline ?? p.description,
        type: 'website',
        siteName: 'MiniRue',
        ...(imgUrl ? { images: [{ url: imgUrl, width: 800, height: 1000, alt: p.name }] } : {}),
      },
      twitter: {
        card: 'summary_large_image',
        title: p.name,
        description: p.tagline ?? p.description,
      },
    };
  } catch {
    return { title: 'Product not found — MiniRue' };
  }
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
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
    <>
      <ProductSchema slug={slug} productName={p!.name} apiProductJson={apiProductJson} />
      <BreadcrumbSchema productName={p!.name} productSlug={slug} />
      <ProductPageClient slug={slug} apiProductJson={apiProductJson} />
    </>
  );
}
