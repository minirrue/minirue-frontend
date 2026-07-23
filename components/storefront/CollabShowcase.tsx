'use client';

import React from 'react';
import Link from 'next/link';
import type { ApiProduct } from '@/lib/api/catalog';
import type { ResolvedSection } from '@/lib/api/storefront';
import ProductCard from './ProductCard';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';

type Section = Extract<ResolvedSection, { type: 'collabShowcase' }>;

export function stepIndex(current: number, direction: -1 | 1, length: number): number {
  if (length <= 1) return 0;
  return (current + direction + length) % length;
}

export default function CollabShowcase({
  section,
  onSelect,
}: {
  section: Section;
  onSelect: (product: ApiProduct) => void;
}) {
  const { mobile } = useBreakpoint();
  const [active, setActive] = React.useState(0);
  const railRef = React.useRef<HTMLDivElement | null>(null);

  if (section.tabs.length === 0) return null;
  const tab = section.tabs[Math.min(active, section.tabs.length - 1)];

  const go = (direction: -1 | 1) => {
    const next = stepIndex(active, direction, section.tabs.length);
    setActive(next);
    // Keep the newly active tab in view on narrow screens. scrollIntoView on the
    // child would scroll the page too; scrolling the rail itself does not.
    const rail = railRef.current;
    const button = rail?.children[next] as HTMLElement | undefined;
    if (rail && button) {
      rail.scrollTo({
        left: button.offsetLeft - rail.clientWidth / 2 + button.clientWidth / 2,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section
      data-screen-label="Storefront · Collaborator showcase"
      data-trace-id="PG-STOREFRONT-COLLAB-002::EL-REGION-collab-showcase"
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: 'clamp(48px,8vw,96px) var(--mr-gutter)',
        borderTop: '1px solid var(--mr-ink-100)',
      }}
    >
      <div style={{ marginBottom: 32 }}>
        {section.eyebrow && (
          <div
            style={{
              fontFamily: 'var(--mr-font-label)',
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--mr-ink-500)',
              marginBottom: 14,
            }}
          >
            {section.eyebrow}
          </div>
        )}
        <h2
          style={{
            fontFamily: 'var(--mr-font-serif)',
            fontWeight: 500,
            fontSize: 'clamp(28px,4vw,42px)',
            lineHeight: 1.08,
            letterSpacing: '-0.006em',
            margin: 0,
            color: 'var(--mr-ink-900)',
          }}
        >
          {section.title}
        </h2>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button
          type="button"
          aria-label="Previous collaborator"
          onClick={() => go(-1)}
          disabled={section.tabs.length <= 1}
          className="mr-nav-link"
          style={{
            background: 'none',
            border: '1px solid var(--mr-hairline)',
            borderRadius: '50%',
            width: 34,
            height: 34,
            cursor: section.tabs.length <= 1 ? 'default' : 'pointer',
            color: 'var(--mr-ink-900)',
            flex: '0 0 auto',
          }}
        >
          ←
        </button>

        <div
          ref={railRef}
          role="tablist"
          aria-label="Collaborators"
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            flex: 1,
          }}
        >
          {section.tabs.map((t, i) => (
            <button
              key={t.collaboratorId}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              data-trace-id={`PG-STOREFRONT-COLLAB-002::EL-TAB-collab@${t.brandSlug}`}
              style={{
                flex: '0 0 auto',
                padding: '10px 18px',
                border: '1px solid',
                borderColor: i === active ? 'var(--mr-gold-400)' : 'var(--mr-hairline)',
                background: i === active ? 'var(--mr-bg-raised)' : 'transparent',
                borderRadius: 999,
                cursor: 'pointer',
                fontFamily: 'var(--mr-font-label)',
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--mr-ink-900)',
                whiteSpace: 'nowrap',
                transition: 'border-color 200ms var(--mr-ease-out), background 200ms var(--mr-ease-out)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-label="Next collaborator"
          onClick={() => go(1)}
          disabled={section.tabs.length <= 1}
          className="mr-nav-link"
          style={{
            background: 'none',
            border: '1px solid var(--mr-hairline)',
            borderRadius: '50%',
            width: 34,
            height: 34,
            cursor: section.tabs.length <= 1 ? 'default' : 'pointer',
            color: 'var(--mr-ink-900)',
            flex: '0 0 auto',
          }}
        >
          →
        </button>
      </div>

      <header
        style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}
      >
        {tab.logoUrl ? (
          <img src={tab.logoUrl} alt="" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 4 }} />
        ) : (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: '1px solid var(--mr-gold-300)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--mr-font-serif)',
              fontSize: 22,
              color: 'var(--mr-gold-500)',
            }}
          >
            {tab.label.charAt(0)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3
            style={{
              fontFamily: 'var(--mr-font-serif)',
              fontWeight: 500,
              fontSize: 'clamp(22px,3vw,32px)',
              margin: '0 0 6px',
              color: 'var(--mr-ink-900)',
            }}
          >
            {tab.label}
          </h3>
          {tab.description && (
            <p style={{ margin: 0, fontFamily: 'var(--mr-font-body)', fontSize: 14, color: 'var(--mr-ink-500)', maxWidth: '52ch' }}>
              {tab.description}
            </p>
          )}
        </div>
        <Link
          href={`/brands/${encodeURIComponent(tab.brandSlug)}`}
          style={{
            fontFamily: 'var(--mr-font-label)',
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--mr-ink-900)',
            borderBottom: '1px solid var(--mr-gold-400)',
            paddingBottom: 2,
            textDecoration: 'none',
          }}
        >
          View collection <span className="mr-link-arrow">→</span>
        </Link>
      </header>

      {tab.products.length === 0 ? (
        <p style={{ fontFamily: 'var(--mr-font-body)', fontSize: 15, color: 'var(--mr-ink-400)', fontStyle: 'italic', margin: 0 }}>
          No products yet from this brand.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 'clamp(16px,3vw,32px)',
          }}
        >
          {tab.products.map((p, i) => (
            <ProductCard
              key={p.id as string}
              product={p as unknown as ApiProduct}
              index={i}
              onClick={() => onSelect(p as unknown as ApiProduct)}
              traceIdPrefix="PG-STOREFRONT-COLLAB-002::EL-CARD-product-card"
            />
          ))}
        </div>
      )}
    </section>
  );
}
