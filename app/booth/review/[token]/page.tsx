import type { Metadata } from 'next';
import GroundReviewClient from './GroundReviewClient';
import './review.css';

export const metadata: Metadata = {
  title: 'Your order review',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default async function GroundReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <GroundReviewClient key={token} token={token} />;
}
