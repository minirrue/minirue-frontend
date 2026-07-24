import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { catalog, primaryMedia, mediaImageUrl, productBrand } from '@/lib/api/catalog';
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
    const brand = productBrand(p);
    return {
      title: brand ? `${p.name} — ${brand}` : p.name,
      description:
        p.tagline ?? p.description ?? (brand ? `${p.name} by ${brand}` : p.name),
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
  // Opt out of the partially-prerendered shell. With Cache Components this
  // route was prerendered and then "resumed" at request time; the replayed
  // tree never matched the stored one, so React logged "Couldn't find all
  // resumable slots by key/index during replaying", discarded the server HTML
  // and fell back to client rendering — which, behind the root layout's
  // <Suspense fallback={null}>, showed an empty page. Rendering on demand
  // removes the shell, so there is nothing to resume and nothing to mismatch.
  await connection();

  // NOTE: this page deliberately does NOT prefetch into React Query and wrap
  // itself in a HydrationBoundary any more. Nothing here consumed that query —
  // the product is passed to the client as `apiProductJson` — but dehydrate()
  // stamps each entry with Date.now(), which baked a build-time timestamp into
  // the partially-prerendered shell. At request time the replayed tree no
  // longer matched it, so React logged "Couldn't find all resumable slots by
  // key/index during replaying" and threw the server HTML away; with the root
  // layout's <Suspense fallback={null}> that left the whole page blank behind
  // the error boundary. The product data is still fetched below, so the markup
  // is unchanged for SEO.
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
