import { cookies } from 'next/headers';
import OrderHistoryClient from './OrderHistoryClient';

export default async function OrderHistoryPage() {
  // Auth-protected route: opt out of static prerender under cacheComponents
  // (middleware already verified the mr-auth cookie; touching the jar here
  // makes the segment dynamic).
  await cookies();
  return <OrderHistoryClient />;
}
