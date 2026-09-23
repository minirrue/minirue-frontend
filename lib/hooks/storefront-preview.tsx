'use client';

/**
 * The draft-preview data override (#193).
 *
 * The dashboard editor frames `/_internal/draft-preview` and posts it the
 * owner's UNSAVED layout, already resolved by the backend. The preview must
 * render it with the live shop's own components, and several of those read
 * the storefront through `useStorefrontHome()`/`useStorefrontChrome()` rather
 * than props (Header reads the mobile menu, socials and shop name that way).
 * So the override lives where those hooks read: inside this provider they
 * return the draft and never fetch; outside it — every live page — the
 * context is null and the hooks are exactly what they were.
 *
 * A separate `'use client'` module on purpose: `lib/hooks/use-storefront.ts`
 * is imported by server components for SSR prefetch, and must not create a
 * React context itself.
 */

import React from 'react';
import type { ResolvedChrome, ResolvedHome } from '@/lib/api/storefront';

export interface StorefrontPreviewData {
  home: ResolvedHome;
  chrome: ResolvedChrome;
}

const StorefrontPreviewContext = React.createContext<StorefrontPreviewData | null>(null);

export function StorefrontPreviewProvider({
  value,
  children,
}: {
  value: StorefrontPreviewData;
  children: React.ReactNode;
}) {
  return (
    <StorefrontPreviewContext.Provider value={value}>{children}</StorefrontPreviewContext.Provider>
  );
}

/** The draft being previewed, or null on every live page. */
export function useStorefrontPreviewData(): StorefrontPreviewData | null {
  return React.useContext(StorefrontPreviewContext);
}

/**
 * `data-preview-id` for a previewable block: the id inside the preview,
 * `undefined` everywhere else. React omits an `undefined` attribute, so the
 * live pages' HTML is unchanged.
 */
export function usePreviewId(id: string): string | undefined {
  return React.useContext(StorefrontPreviewContext) ? id : undefined;
}
