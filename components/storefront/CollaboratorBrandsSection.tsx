'use client';

import React from 'react';
import Link from 'next/link';
import type { ApiProduct } from '@/lib/api/catalog';
import type { CollaboratorBrandSection } from '@/lib/api/collaborators';
import ProductCard from './ProductCard';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';

interface Props {
  sections: CollaboratorBrandSection[];
  onSelect: (product: ApiProduct) => void;
}

export default function CollaboratorBrandsSection({ sections, onSelect }: Props) {
  const { mobile } = useBreakpoint();

  if (!sections.length) return null;

  return (
    <section
      data-screen-label="Storefront · Collaborator brands"
      data-trace-id="PG-STOREFRONT-COLLAB-001::EL-REGION-collaborator-brands-section"
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: 'clamp(48px,8vw,96px) var(--mr-gutter)',
        borderTop: '1px solid var(--mr-ink-100)',
      }}
    >
      <div
        data-trace-id="PG-STOREFRONT-COLLAB-001::EL-REGION-collaborator-brands-heading"
        style={{ marginBottom: 48 }}
      >
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
          Maison partners
        </div>
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
          Collaborator ateliers
        </h2>
      </div>

      <div
        data-trace-id="PG-STOREFRONT-COLLAB-001::EL-LIST-collaborator-brand-list"
        style={{ display: 'flex', flexDirection: 'column', gap: mobile ? 56 : 80 }}
      >
        {sections.map((section) => (
          <article
            key={section.brandSlug}
            data-trace-id={`PG-STOREFRONT-COLLAB-001::EL-CARD-brand-section@${section.brandSlug}`}
          >
            <header
              data-trace-id={`PG-STOREFRONT-COLLAB-001::EL-REGION-brand-identity-header@${section.brandSlug}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                marginBottom: 28,
                flexWrap: 'wrap',
              }}
            >
              {section.logoUrl ? (
                <img
                  src={section.logoUrl}
                  alt=""
                  style={{
                    width: 56,
                    height: 56,
                    objectFit: 'contain',
                    borderRadius: 4,
                  }}
                />
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
                  {section.brandName.charAt(0)}
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
                  {section.brandName}
                </h3>
                {section.description && (
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'var(--mr-font-body)',
                      fontSize: 14,
                      color: 'var(--mr-ink-500)',
                      maxWidth: '52ch',
                    }}
                  >
                    {section.description}
                  </p>
                )}
              </div>
              <Link
                href={`/brands/${encodeURIComponent(section.brandSlug)}`}
                data-trace-id={`PG-STOREFRONT-COLLAB-001::EL-LINK-view-collection@${section.brandSlug}`}
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

            {section.products.length === 0 ? (
              <p
                style={{
                  fontFamily: 'var(--mr-font-body)',
                  fontSize: 15,
                  color: 'var(--mr-ink-400)',
                  fontStyle: 'italic',
                  margin: 0,
                }}
              >
                No products yet from this brand.
              </p>
            ) : (
              <div
                data-trace-id={`PG-STOREFRONT-COLLAB-001::EL-LIST-brand-home-product-grid@${section.brandSlug}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: mobile
                    ? 'repeat(2, 1fr)'
                    : 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 'clamp(16px,3vw,32px)',
                }}
              >
                {section.products.map((p, i) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    index={i}
                    onClick={() => onSelect(p)}
                    traceIdPrefix="PG-STOREFRONT-COLLAB-001::EL-CARD-product-card"
                  />
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
