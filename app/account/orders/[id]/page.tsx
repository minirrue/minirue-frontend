import { cookies } from 'next/headers';
import OrderDetailClient from './OrderDetailClient';

export default async function OrderDetailPage() {
  // Auth-protected route: opt out of static prerender under cacheComponents
  // (middleware already verified the mr-auth cookie; touching the jar here
  // makes the segment dynamic).
  await cookies();
  return <OrderDetailClient />;
}
