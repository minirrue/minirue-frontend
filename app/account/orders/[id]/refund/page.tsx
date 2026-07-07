import { cookies } from 'next/headers';
import RefundRequestClient from './RefundRequestClient';

export default async function RefundRequestPage({ params }: { params: Promise<{ id: string }> }) {
  // Auth-protected route: opt out of static prerender under cacheComponents
  // (middleware already verified the mr-auth cookie; touching the jar here
  // makes the segment dynamic).
  await cookies();
  const { id: orderId } = await params;
  return <RefundRequestClient orderId={orderId} />;
}
