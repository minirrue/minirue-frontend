'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { setSessionExpiredHandler } from '@/lib/api/client';

export default function SessionExpiredHandler() {
  const router = useRouter();

  React.useEffect(() => {
    setSessionExpiredHandler((returnPath) => {
      const next = encodeURIComponent(returnPath);
      router.push(`/login?next=${next}&reason=session-expired`);
    });
    return () => setSessionExpiredHandler(null);
  }, [router]);

  return null;
}
