'use client';

/**
 * MobileNavSheet — the phone navigation, as a bottom sheet.
 *
 * Replaces the old 280px left slide-out. MiniRue is mobile-first, and a
 * left drawer puts the menu where a thumb cannot reach it; a sheet rising from
 * the bottom edge lands under the thumb and keeps the page visible above it.
 *
 * Motion contract (matches the reference spec exactly):
 *   sheet     transform 600ms cubic-bezier(0.7, 0, 0.2, 1), translateY(100%) -> 0
 *   contents  transform 600ms cubic-bezier(0.075, 0.82, 0.165, 1)
 *             opacity   600ms cubic-bezier(0.19, 1, 0.22, 1)
 *             delay 300ms + 100ms per item, so items only start moving once the
 *             sheet is roughly half-open. The per-item step is capped at 900ms
 *             total: the spec's uncapped +100ms would make a ten-item menu take
 *             1.3s to finish, which reads as lag rather than choreography.
 *
 * The 60px top inset is deliberate — the sheet must never cover the status bar
 * or the header it came from, so the shopper keeps their place in the page.
 *
 * Category items that the admin pinned products to (`item.featured`) drill down
 * into a second panel instead of navigating; everything else is a plain link.
 */

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import IconButton from '@/components/ui/IconButton';
import SocialIcon from '@/components/ui/SocialIcon';
import Wordmark from '@/components/ui/Wordmark';
import type { ApiProduct } from '@/lib/api/catalog';
import type { ResolvedChrome, ResolvedNavItem } from '@/lib/api/storefront';
import NavProductTile from './NavProductTile';

const SHEET_EASE = 'cubic-bezier(0.7,0,0.2,1)';
const ITEM_TRANSITION =
  'transform 600ms cubic-bezier(0.075,0.82,0.165,1), opacity 600ms cubic-bezier(0.19,1,0.22,1)';

/** 300ms base + 100ms per item, capped so long menus stay snappy. */
function itemDelay(index: number): string {
  return `${Math.min(300 + index * 100, 900)}ms`;
}

interface MobileNavSheetProps {
  open: boolean;
  onClose: () => void;
  navbar: ResolvedChrome['navbar'];
  socials: ResolvedChrome['footer']['socials'];
  signedIn: boolean;
  onOpenSearch: () => void;
}

export default function MobileNavSheet({
  open,
  onClose,
  navbar,
  socials,
  signedIn,
  onOpenSearch,
}: MobileNavSheetProps) {
  const [drilledId, setDrilledId] = React.useState<string | null>(null);

  // Closing resets the drill-down, but only after the sheet is gone — resetting
  // immediately would flip the panel back to root in full view on the way out.
  React.useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setDrilledId(null), 600);
    return () => clearTimeout(t);
  }, [open]);

  // Escape closes the drill-down first, then the sheet — one Escape should not
  // discard two levels of navigation at once.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (drilledId) setDrilledId(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, drilledId, onClose]);

  // Lock the page behind the sheet, otherwise scrolling inside the sheet chains
  // to the body once it hits its end and the page slides under the shopper.
  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const drilled = navbar.items.find((i) => i.id === drilledId) ?? null;
  const drilledProducts = (drilled?.featured ?? []) as unknown as ApiProduct[];

  const shortcuts: Array<{ id: string; label: string; icon: 'home' | 'search' | 'user'; href?: string; onClick?: () => void }> = [
    { id: '__home', label: 'Home', icon: 'home', href: '/' },
    { id: '__search', label: 'Search', icon: 'search', onClick: onOpenSearch },
    {
      id: '__account',
      label: signedIn ? 'Account' : 'Sign in',
      icon: 'user',
      href: signedIn ? '/account/profile' : '/login',
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(11,11,11,0.5)',
          backdropFilter: open ? 'blur(4px)' : 'blur(0)',
          WebkitBackdropFilter: open ? 'blur(4px)' : 'blur(0)',
          opacity: open ? 1 : 0,
          transition: 'opacity 400ms var(--mr-ease-snappy), backdrop-filter 400ms ease',
        }}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        data-trace-id="PG-STOREFRONT-NAV-001::EL-REGION-mobile-nav-sheet"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: 'calc(100dvh - 60px)',
          height: 'calc(100dvh - 60px)',
          background: 'var(--mr-cream-100)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -18px 48px rgba(11,11,11,0.24)',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: `transform 600ms ${SHEET_EASE}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header — grabber, title/back, close */}
        <div style={{ position: 'relative', flex: '0 0 auto', padding: '18px 20px 12px' }}>
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 48,
              height: 4,
              borderRadius: 2,
              background: 'var(--mr-cream-400)',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 6,
            }}
          >
            {drilled ? (
              <button
                type="button"
                onClick={() => setDrilledId(null)}
                data-trace-id="PG-STOREFRONT-NAV-001::EL-BTN-mobile-nav-back"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'none',
                  border: 0,
                  padding: '4px 0',
                  cursor: 'pointer',
                  color: 'var(--mr-fg)',
                  fontFamily: 'var(--mr-font-serif)',
                  fontSize: 20,
                }}
              >
                <Icon name="chevronLeft" size={18} />
                {drilled.label}
              </button>
            ) : (
              <Link
                href="/"
                aria-label="MiniRue — home"
                onClick={onClose}
                style={{ display: 'inline-flex', textDecoration: 'none', color: 'inherit' }}
              >
                <Wordmark size={18} />
              </Link>
            )}
            <IconButton icon="close" size={36} tone="cream" label="Close menu" onClick={onClose} />
          </div>
        </div>

        {/* Panels — root slides left as the drill-down slides in from the right */}
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          {/* Root panel */}
          <div
            aria-hidden={drilled ? 'true' : undefined}
            style={{
              position: 'absolute',
              inset: 0,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: '4px 20px 20px',
              transform: drilled ? 'translateX(-24%)' : 'translateX(0)',
              opacity: drilled ? 0 : 1,
              pointerEvents: drilled ? 'none' : 'auto',
              transition: `transform 420ms ${SHEET_EASE}, opacity 260ms ease`,
            }}
          >
            {/* Shortcut row — Home / Search / Account as icon + text, because a
                text-only list makes the three most-used actions look like menu
                items rather than the controls they are. */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                marginBottom: 20,
                opacity: open && !drilled ? 1 : 0,
                transform: open && !drilled ? 'translateY(0)' : 'translateY(20px)',
                transition: ITEM_TRANSITION,
                transitionDelay: open ? itemDelay(0) : '0ms',
              }}
            >
              {shortcuts.map((s) => {
                const inner = (
                  <>
                    <Icon name={s.icon} size={20} />
                    <span
                      style={{
                        fontFamily: 'var(--mr-font-label)',
                        fontSize: 11,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {s.label}
                    </span>
                  </>
                );
                const style: React.CSSProperties = {
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '16px 8px',
                  background: 'var(--mr-cream-200)',
                  border: '1px solid var(--mr-hairline)',
                  borderRadius: 'var(--mr-radius-lg)',
                  color: 'var(--mr-fg)',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  width: '100%',
                };
                return s.href ? (
                  <Link
                    key={s.id}
                    href={s.href}
                    onClick={onClose}
                    data-trace-id={`PG-STOREFRONT-NAV-001::EL-LINK-mobile-nav-shortcut@${s.id}`}
                    style={style}
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      s.onClick?.();
                    }}
                    data-trace-id={`PG-STOREFRONT-NAV-001::EL-BTN-mobile-nav-shortcut@${s.id}`}
                    style={style}
                  >
                    {inner}
                  </button>
                );
              })}
            </div>

            {navbar.items.map((item, i) => (
              <MobileNavRow
                key={item.id}
                item={item}
                index={i + 1}
                revealed={open && !drilled}
                onDrill={() => setDrilledId(item.id)}
                onClose={onClose}
              />
            ))}

            {navbar.items.length === 0 && (
              <p
                style={{
                  fontFamily: 'var(--mr-font-ui)',
                  fontSize: 'var(--mr-text-sm)',
                  color: 'var(--mr-fg-4)',
                }}
              >
                No menu items yet.
              </p>
            )}
          </div>

          {/* Drill-down panel */}
          <div
            aria-hidden={drilled ? undefined : 'true'}
            style={{
              position: 'absolute',
              inset: 0,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: '4px 20px 20px',
              transform: drilled ? 'translateX(0)' : 'translateX(24%)',
              opacity: drilled ? 1 : 0,
              pointerEvents: drilled ? 'auto' : 'none',
              transition: `transform 420ms ${SHEET_EASE}, opacity 260ms ease`,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {drilledProducts.map((product, i) => (
                <NavProductTile
                  key={product.id}
                  product={product}
                  index={i}
                  revealed={Boolean(drilled)}
                  onNavigate={onClose}
                />
              ))}
            </div>

            {drilled && (
              <Link
                href={drilled.href}
                onClick={onClose}
                data-trace-id="PG-STOREFRONT-NAV-001::EL-LINK-mobile-nav-view-all"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  marginTop: 24,
                  padding: '16px 20px',
                  borderRadius: 'var(--mr-radius-pill)',
                  background: 'var(--mr-ink-900)',
                  color: 'var(--mr-cream-100)',
                  textDecoration: 'none',
                  fontFamily: 'var(--mr-font-label)',
                  fontSize: 12,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  opacity: drilled ? 1 : 0,
                  transform: drilled ? 'translateY(0)' : 'translateY(20px)',
                  transition: ITEM_TRANSITION,
                  transitionDelay: drilled ? itemDelay(drilledProducts.length) : '0ms',
                }}
              >
                All {drilled.label}
                <span className="mr-link-arrow">→</span>
              </Link>
            )}
          </div>
        </div>

        {/* Footer bar — account action + socials, pinned so it survives scrolling */}
        <div
          style={{
            flex: '0 0 auto',
            borderTop: '1px solid var(--mr-hairline)',
            background: 'var(--mr-cream-200)',
            padding: '14px 20px calc(14px + env(safe-area-inset-bottom))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <Link
            href={signedIn ? '/account/profile' : '/login'}
            onClick={onClose}
            data-trace-id="PG-STOREFRONT-NAV-001::EL-LINK-mobile-nav-account-cta"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 22px',
              borderRadius: 'var(--mr-radius-pill)',
              background: 'var(--mr-ink-900)',
              color: 'var(--mr-cream-100)',
              textDecoration: 'none',
              fontFamily: 'var(--mr-font-label)',
              fontSize: 12,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            <Icon name="user" size={16} />
            {signedIn ? 'Account' : 'Login'}
          </Link>

          <div style={{ display: 'flex', gap: 14 }}>
            {socials.map((s) => (
              <a
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.network}
                style={{ color: 'var(--mr-fg-3)', display: 'inline-flex' }}
              >
                <SocialIcon network={s.network} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** One row of the root panel: a link, or a drill-down trigger when the admin
 *  pinned products to this category. */
function MobileNavRow({
  item,
  index,
  revealed,
  onDrill,
  onClose,
}: {
  item: ResolvedNavItem;
  index: number;
  revealed: boolean;
  onDrill: () => void;
  onClose: () => void;
}) {
  const hasPanel = (item.featured?.length ?? 0) > 0;

  const style: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
    background: 'none',
    border: 0,
    borderBottom: '1px solid var(--mr-hairline)',
    textAlign: 'left',
    padding: '16px 0',
    fontFamily: 'var(--mr-font-serif)',
    fontSize: 24,
    lineHeight: 1.2,
    color: 'var(--mr-fg)',
    textDecoration: 'none',
    cursor: 'pointer',
    opacity: revealed ? 1 : 0,
    transform: revealed ? 'translateY(0)' : 'translateY(20px)',
    transition: ITEM_TRANSITION,
    transitionDelay: revealed ? itemDelay(index) : '0ms',
  };

  if (hasPanel) {
    return (
      <button
        type="button"
        onClick={onDrill}
        aria-expanded={false}
        data-trace-id={`PG-STOREFRONT-NAV-001::EL-BTN-mobile-nav-drill@${item.id}`}
        style={style}
      >
        {item.label}
        <Icon name="chevronRight" size={18} />
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onClose}
      data-trace-id={`PG-STOREFRONT-NAV-001::EL-LINK-mobile-nav-item@${item.id}`}
      style={style}
    >
      {item.label}
      <Icon name="chevronRight" size={18} />
    </Link>
  );
}
