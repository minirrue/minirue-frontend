import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function AccountIndexPage() {
  // Auth-protected route: opt out of static prerender under cacheComponents
  // (middleware already verified the mr-auth cookie; touching the jar here
  // makes the segment dynamic).
  await cookies();
  redirect('/account/profile');
}
