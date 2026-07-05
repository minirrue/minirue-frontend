'use client';

import React from 'react';
import { apiGetPublicSettings, type StorefrontPublicSettings } from '@/lib/api/settings';

export function usePublicStorefront(): {
  storefront: StorefrontPublicSettings | null;
  footerTagline: string | undefined;
} {
  const [storefront, setStorefront] = React.useState<StorefrontPublicSettings | null>(null);
  const [footerTagline, setFooterTagline] = React.useState<string | undefined>();

  React.useEffect(() => {
    let cancelled = false;
    void apiGetPublicSettings()
      .then((settings) => {
        if (cancelled) return;
        setStorefront(settings.storefront);
        setFooterTagline(settings.storefront.footerTagline ?? undefined);
      })
      .catch(() => {
        /* keep defaults in chrome components */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { storefront, footerTagline };
}
