'use client';

/**
 * Shared impression/click plumbing for the storefront's product grids
 * (CatalogProductGrid, ProductGrid). Neither grid's card component
 * (CatalogProductCard / ProductCard) is instrumented directly — both are
 * reused in places that should not carry `product_impression`/`product_click`
 * — so this hook wraps each card from the grid instead, via a thin marker
 * element carrying `data-mr-impression-*` attributes.
 *
 * One IntersectionObserver per grid, threshold 0.5, each product firing
 * `product_impression` at most once per page view (tracked in a ref-held Set
 * that survives the observer being recreated when `products` changes, e.g.
 * a "Load more" append) — and disconnected on unmount, so a long catalogue
 * page never leaks one.
 */

import React from 'react';
import { track } from '@/lib/analytics';

export function useProductGridTracking(products: readonly { id: string }[], listId: string | undefined) {
  const gridRef = React.useRef<HTMLDivElement>(null);
  const seenRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const container = gridRef.current;
    if (!container) return;

    const nodes = Array.from(
      container.querySelectorAll<HTMLElement>('[data-mr-impression-id]'),
    );
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          const id = el.getAttribute('data-mr-impression-id');
          const posAttr = el.getAttribute('data-mr-impression-pos');
          if (!id || seenRef.current.has(id)) continue;
          seenRef.current.add(id);
          track('product_impression', {
            productId: id,
            listId,
            position: posAttr ? Number(posAttr) : 0,
          });
          observer.unobserve(el);
        }
      },
      { threshold: 0.5 },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
    // `products` (not just its length) so a "Load more" append re-observes
    // the newly rendered cards; already-seen ids are skipped via seenRef.
  }, [products, listId]);

  /** Spread onto the element wrapping each card. */
  function impressionProps(productId: string, position: number) {
    return {
      'data-mr-impression-id': productId,
      'data-mr-impression-pos': position,
      onClickCapture: () => {
        track('product_click', { productId, listId, position });
      },
    } as const;
  }

  return { gridRef, impressionProps };
}
