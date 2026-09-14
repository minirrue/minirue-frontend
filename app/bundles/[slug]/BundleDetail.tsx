'use client';

import React from 'react';
import Link from 'next/link';
import UploadPreviewImage from '@/components/storefront/UploadPreviewImage';
import Icon from '@/components/ui/Icon';
import Button from '@/components/ui/Button';
import { useCart } from '@/components/storefront/cart/CartContext';
import type { Bundle } from '@/lib/api/bundles';
import { productPath } from '@/lib/routes';
import { formatMoney } from '@/lib/format/money';

/**
 * One set: what is in it, what it costs, and one button.
 *
 * The set goes into the bag as a single act — it cannot be part-bought, which
 * is what makes the single price honest. Underneath, the server writes each
 * member as its own line sharing a group key, so the warehouse still knows
 * what to pack.
 */
export default function BundleDetail({ bundle }: { bundle: Bundle }) {
  const { addBundle } = useCart();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await addBundle(bundle.slug);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'We could not add this set just now. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 'var(--mr-content-max)',
        margin: '0 auto',
        padding: 'clamp(24px,3vw,40px) var(--mr-gutter) clamp(48px,8vw,96px)',
        minHeight: '60vh',
      }}
    >
      <nav
        aria-label="Breadcrumb"
        style={{
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xs)',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--mr-fg-4)',
          marginBottom: 'var(--mr-sp-6)',
          display: 'flex',
          gap: 'var(--mr-sp-2)',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Link href="/shop" style={{ color: 'inherit', textDecoration: 'none' }}>
          Shop
        </Link>
        <span aria-hidden="true">/</span>
        <Link href="/bundles" style={{ color: 'inherit', textDecoration: 'none' }}>
          Bundles
        </Link>
        <span aria-hidden="true">/</span>
        <span style={{ color: 'var(--mr-fg-2)' }}>{bundle.name}</span>
      </nav>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'clamp(24px,5vw,64px)',
          alignItems: 'start',
        }}
      >
        <div
          style={{
            aspectRatio: '1 / 1',
            background: 'var(--mr-bg-2, #f4f1ec)',
            borderRadius: 6,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // `fill` below is absolutely positioned and needs a positioned
            // ancestor, the same as any `next/image fill`.
            position: 'relative',
          }}
        >
          {bundle.imageUrl ? (
            <UploadPreviewImage
              src={bundle.imageUrl}
              alt={bundle.name}
              fill
              /*
                The LCP candidate on this page — one square photograph beside
                the copy. Geometry: `<main>` is max 1280px of content inside
                `var(--mr-gutter)` = clamp(20px, 4vw, 48px); the grid is
                `auto-fit, minmax(280px, 1fr)` with a clamp(24px, 5vw, 64px)
                gap, so it is two equal columns as soon as 2·280 + gap fits and
                one full-width column below that.

                  390px viewport → gutter 20 → row 350, 560+24 does not fit
                                 → one column →                      350px
                 1440px viewport → gutter 48 → row 1280, gap 64
                                 → (1280 − 64) / 2 =                  608px

                The flip happens at ≈646px of viewport. Above it the column is
                (0.92·vw − 0.05·vw) / 2 = 0.435·vw while the row is fluid, and
                a flat 608px once the row pins at 1280 (viewport ≥ 1376). 45vw
                bounds the fluid stretch from above at every width in between.
              */
              sizes="(max-width: 645px) calc(100vw - 40px), (max-width: 1376px) 45vw, 610px"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <Icon name="grid" size={40} color="var(--mr-fg-4)" />
          )}
        </div>

        <div>
          <h1
            style={{
              fontFamily: 'var(--mr-font-serif)',
              fontWeight: 400,
              fontSize: 'clamp(var(--mr-text-xl), 3.5vw, var(--mr-text-3xl))',
              lineHeight: 1.1,
              margin: '0 0 var(--mr-sp-3)',
            }}
          >
            {bundle.name}
          </h1>

          <p
            style={{
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-lg)',
              color: 'var(--mr-fg)',
              margin: '0 0 var(--mr-sp-1)',
            }}
          >
            {formatMoney(bundle.priceMinor / 100, bundle.currency)}
          </p>

          {bundle.savingMinor > 0 && (
            // The honest comparison, computed from today's prices rather than a
            // stored number that would quietly become a lie.
            <p
              style={{
                fontFamily: 'var(--mr-font-ui)',
                fontSize: 'var(--mr-text-sm)',
                color: 'var(--mr-fg-4)',
                margin: '0 0 var(--mr-sp-5)',
              }}
            >
              Instead of {formatMoney(bundle.listTotalMinor / 100, bundle.currency)} bought
              separately — you save {formatMoney(bundle.savingMinor / 100, bundle.currency)}.
            </p>
          )}

          {bundle.description && (
            <p
              style={{
                color: 'var(--mr-fg-3)',
                maxWidth: '55ch',
                margin: '0 0 var(--mr-sp-5)',
              }}
            >
              {bundle.description}
            </p>
          )}

          <h2
            style={{
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--mr-fg-3)',
              margin: '0 0 var(--mr-sp-3)',
            }}
          >
            What is inside
          </h2>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 var(--mr-sp-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--mr-sp-2)',
            }}
          >
            {bundle.members.map((m) => (
              <li
                key={`${m.productId}-${m.variantId ?? 'any'}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 'var(--mr-sp-3)',
                  fontFamily: 'var(--mr-font-ui)',
                  fontSize: 'var(--mr-text-sm)',
                  color: 'var(--mr-fg-2)',
                }}
              >
                {/* Direct, not via the redirect. The bundles API sends each
                    member's categorySlug now, so this resolves straight to
                    /shop/{category}/{product} — an internal link should never
                    spend a round trip discovering where it already knows it is
                    going. */}
                <Link
                  href={productPath({ slug: m.productSlug, categorySlug: m.categorySlug })}
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  {m.quantity > 1 && `${m.quantity} × `}
                  {m.productName}
                  <span style={{ color: 'var(--mr-fg-4)' }}> · {m.brandName}</span>
                </Link>
                <span style={{ color: 'var(--mr-fg-4)', whiteSpace: 'nowrap' }}>
                  {formatMoney(m.unitMinor / 100, bundle.currency)}
                </span>
              </li>
            ))}
          </ul>

          <Button
            variant="primary"
            sweep
            onClick={add}
            disabled={busy || !bundle.inStock}
            style={{ width: '100%', maxWidth: 320 }}
          >
            {!bundle.inStock
              ? 'Currently unavailable'
              : busy
                ? 'Adding'
                : 'Add set to bag'}
          </Button>

          {error && (
            <p
              role="status"
              style={{
                marginTop: 'var(--mr-sp-3)',
                fontFamily: 'var(--mr-font-ui)',
                fontSize: 'var(--mr-text-xs)',
                color: 'var(--mr-fg-3)',
              }}
            >
              {error}
            </p>
          )}

          <p
            style={{
              marginTop: 'var(--mr-sp-3)',
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-xs)',
              color: 'var(--mr-fg-4)',
            }}
          >
            A set is bought whole. Discount codes do not apply to sets.
          </p>
        </div>
      </div>
    </main>
  );
}
