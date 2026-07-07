import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { catalog, primaryMedia, cloudinaryUrl } from '@/lib/api/catalog';
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
    const imgUrl = media
      ? cloudinaryUrl(media.cloudinaryPublicId, { w: 1200, h: 1200 })
      : undefined;
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
      <FooterWithSettings />
    </>
  );
}
