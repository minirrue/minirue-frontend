/**
 * Account layout — customer self-service (Role.CUSTOMER)
 * Protection: middleware checks mr-auth cookie on /account/*
 *
 * Cache Components–compatible dynamic-rendering opt-out.
 *
 * - The `await cookies()` call is placed INSIDE the `<Suspense>` boundary
 *   so that the uncached data access lives within a Suspense scope. Reading
 *   the cookie jar here (with a null fallback) empties the static shell for
 *   the entire /account/* subtree and defers every page under it to request
 *   time. This is the recommended pattern for fully-dynamic subtrees per
 *   the Next.js 16 caching docs.
 */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import AccountLayoutClient from './AccountLayoutClient';

export const metadata: Metadata = {
  title: 'My Account — MiniRue',
  robots: 'noindex, nofollow',
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={null}
    >
      {/*
        Opts the route out of static rendering. middleware has already
        verified the mr-auth cookie — touching the cookie jar here also
        makes this segment dynamic under Cache Components. MUST be inside
        a <Suspense> boundary (with a null fallback) so the static shell
        can be generated and the dynamic part streams at request time.
      */}
      <DynamicShell>
        <AccountLayoutClient>{children}</AccountLayoutClient>
      </DynamicShell>
    </Suspense>
  );
}

async function DynamicShell({ children }: { children: React.ReactNode }) {
  await cookies();
  return <>{children}</>;
}
