import { cookies } from 'next/headers';
import RefundsPageClient from './RefundsPageClient';

export default async function RefundsPage() {
  // Auth-protected route: opt out of static prerender under cacheComponents
  // (middleware already verified the mr-auth cookie; touching the jar here
  // makes the segment dynamic) — same pattern as every other /account/**
  // page.
  await cookies();
  return <RefundsPageClient />;
}
