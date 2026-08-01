import type { Metadata } from 'next';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import FooterWithSettings from '@/components/layout/FooterWithSettings';
import HeaderWrapper from '@/app/products/HeaderWrapper';
import { getBundle, type Bundle } from '@/lib/api/bundles';
import BundleDetail from './BundleDetail';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const bundle = await getBundle(slug);
    return {
      title: `${bundle.name} — MiniRue`,
      description:
        bundle.description ??
        `${bundle.members.length} pieces, priced as one set.`,
      alternates: { canonical: `/bundles/${bundle.slug}` },
    };
  } catch {
    // A set that has been retired should not carry a title claiming it exists.
    return { title: 'Bundle — MiniRue' };
  }
}

export default async function BundlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;

  let bundle: Bundle;
  try {
    bundle = await getBundle(slug);
  } catch {
    // Retired, hidden, or never existed — all the same to a shopper, and all a
    // 404 rather than an error page.
    notFound();
  }

  return (
    <>
      <div className="mr-page-sheet">
        <AnnouncementBar />
        <HeaderWrapper />
        <BundleDetail bundle={bundle} />
      </div>
      <FooterWithSettings />
    </>
  );
}
