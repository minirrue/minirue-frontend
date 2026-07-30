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

      // Only interrupt someone standing somewhere that genuinely needs a
      // session. On a product page, a brand page or the home page there is
      // nothing to sign in FOR — the page renders perfectly for a guest — so
      // yanking them to /login because a background poll expired is pure lost
      // traffic. It also read as a bug, because the shopper did nothing to
      // provoke it. Anywhere else, they simply stay where they are; the
      // account menu already reflects that they are signed out, and the next
      // thing they deliberately do that needs a session will take them to
      // login with a reason they can connect to their own action.
      //
      // Mirrors PROTECTED in proxy.ts — keep the two in step.
      const PROTECTED = ['/account', '/orders'];
      const path = window.location.pathname;
      const needsSession = PROTECTED.some(
        (p) => path === p || path.startsWith(`${p}/`),
      );
      if (!needsSession) return;

      const next = encodeURIComponent(returnPath);
      router.push(`/login?next=${next}&reason=session-expired`);
    });
    return () => setSessionExpiredHandler(null);
  }, [router]);

  return null;
}
