'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { setSessionExpiredHandler } from '@/lib/api/client';

export default function SessionExpiredHandler() {
  const router = useRouter();

  React.useEffect(() => {
    setSessionExpiredHandler((returnPath) => {
      // Belt and braces with the once-only guard in apiFetch: if we are already
      // heading to (or sitting on) the login screen, pushing again is what
      // turned an expired session into a navigation every poll cycle.
      if (window.location.pathname.startsWith('/login')) return;
      const next = encodeURIComponent(returnPath);
      router.push(`/login?next=${next}&reason=session-expired`);
    });
    return () => setSessionExpiredHandler(null);
  }, [router]);

  return null;
}
