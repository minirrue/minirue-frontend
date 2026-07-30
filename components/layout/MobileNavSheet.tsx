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
 *   drill     transform 500ms cubic-bezier(.3, 1, .3, 1), a panel entering
 *             translateX(100%) -> 0 while the panel behind it settles at
 *             translateX(-30%) and drops in z-index. Distinct from the
 *             sheet's own open/close curve above, which this never touches.
 *
 * The 60px top inset is deliberate — the sheet must never cover the status bar
 * or the header it came from, so the shopper keeps their place in the page.
 *
 * Shortcuts (top tile row) and the footer button are fully admin-configured
 * (`mobileMenu`, resolved server-side in storefront.resolver.ts) rather than
 * hardcoded — a shop that never opens the dashboard's "Mobile menu" editor
 * gets the Home/Search/Account defaults, unchanged from before this existed.
 *
 * A category nav item drills in when it has real subcategories
 * (`item.children`, resolved from the catalog tree), pinned products
 * (`item.featured`, admin-configured), or — when a category has neither, the
 * common case for a shop that never curated its nav — its own real products
 * (`item.products`, resolved from the catalog). Any one is enough. Without
 * that last fallback, a leaf category nobody pinned anything to had nothing
 * to open a panel with and fell through to a plain link even though it was
 * full of products — that was the reported bug ("Perfumes" navigating away
 * instead of drilling). Drilling is a stack, not a single `drilledId`: a
 * subcategory can itself have children, so the shopper can go arbitrarily
 * deep, with Escape / the back button unwinding one level at a time.
 */

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import IconButton from '@/components/ui/IconButton';
import SocialIcon from '@/components/ui/SocialIcon';
import Wordmark from '@/components/ui/Wordmark';
import type { ApiProduct } from '@/lib/api/catalog';
import type {
  ResolvedChrome,
  ResolvedMobileMenuItem,
  ResolvedNavItem,
  SocialNetwork,
} from '@/lib/api/storefront';
import { useSheetDrag } from '@/lib/hooks/useSheetDrag';
import { useSpringValue } from '@/lib/motion/hooks';
import NavProductTile from './NavProductTile';

// The sheet's own open/close timing lives in lib/motion/sheet.ts so this
// sheet, SearchSheet and any new one share a single definition instead of
// three copies drifting apart. Left untouched by this file.
import { SHEET_EASE, ITEM_TRANSITION, itemDelay } from '@/lib/motion/sheet';

/** The drill transition's own curve — owner-specified, distinct from
 * `SHEET_EASE` (the sheet's open/close) and from the light content easing
 * above. Kept local to this file rather than added to lib/motion/sheet.ts,
 * which SearchSheet also depends on and this task does not own. */
const DRILL_EASE = 'cubic-bezier(.3,1,.3,1)';
const DRILL_DURATION_MS = 500;

/** Reads `prefers-reduced-motion` at the JS level for the drill transition
 * specifically. The sheet's own open/close and the item stagger rely on
 * mr-tokens.css's global `transition-duration: 0.01ms !important` rule and
 * need no branch here (see lib/motion/sheet.ts) — this hook exists so the
 * drill transition is explicitly, testably disabled too. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return reduced;
}

interface MobileNavSheetProps {
  open: boolean;
  onClose: () => void;
  navbar: ResolvedChrome['navbar'];
  mobileMenu: ResolvedChrome['mobileMenu'];
  socials: ResolvedChrome['footer']['socials'];
  signedIn: boolean;
  onOpenSearch: () => void;
}

/** Whether a nav item opens a drill-down panel — real subcategories, pinned
 *  products, or (when neither was set up) the category's own real products,
 *  any one is enough. Without `products` in this check, a category nobody
 *  ever pinned anything to and that has no subcategories would still look
 *  "flat" and fall through to a plain link — the exact bug this exists to
 *  close. Shared by the root list and every nested panel, since a resolved
 *  child has the same shape as a top-level nav item. */
function canDrill(item: ResolvedNavItem): boolean {
  return (
    (item.children?.length ?? 0) > 0 ||
    (item.featured?.length ?? 0) > 0 ||
    (item.products?.length ?? 0) > 0
  );
}

/** The product tiles a drill panel shows: admin-pinned first, then the
 *  category's own real products (already excludes anything pinned — the
 *  backend does that once so every reader doesn't have to). */
function panelProducts(item: ResolvedNavItem): ApiProduct[] {
  return [
    ...((item.featured as unknown as ApiProduct[] | undefined) ?? []),
    ...((item.products as unknown as ApiProduct[] | undefined) ?? []),
  ];
}

export default function MobileNavSheet({
  open,
  onClose,
  navbar,
  mobileMenu,
  socials,
  signedIn,
  onOpenSearch,
}: MobileNavSheetProps) {
  // The chain of drilled items, root-out: [] is the root panel, [A] is one
  // level deep into A, [A, B] is two levels deep into A's child B, and so on.
  const [drillPath, setDrillPath] = React.useState<ResolvedNavItem[]>([]);
  const reducedMotion = usePrefersReducedMotion();
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const drag = useSheetDrag({
    direction: 'down',
    enabled: open,
    onDismiss: onClose,
    sheetRef,
  });

  // Closing resets the drill stack, but only after the sheet is gone —
  // resetting immediately would flip every panel back to root in full view
  // on the way out.
  React.useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setDrillPath([]), 600);
    return () => clearTimeout(t);
  }, [open]);

  // Escape backs out one level at a time, then closes — one Escape should
  // never discard more than one level of navigation, and should never skip
  // straight past a multi-level drill to closed.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setDrillPath((path) => {
        if (path.length > 0) return path.slice(0, -1);
        onClose();
        return path;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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

  const current = drillPath.at(-1) ?? null;

  const back = () => setDrillPath((path) => path.slice(0, -1));
  const drillInto = (item: ResolvedNavItem) => setDrillPath((path) => [...path, item]);

  // ── Shortcuts (top tile row) and footer button share this resolution ───
  // 'search' opens the sheet in place and 'account' depends on sign-in state
  // — neither has a backend-resolved href, so both are special-cased here
  // exactly as the old hardcoded array was. Everything else uses the
  // pre-resolved href untouched.
  const resolveMobileMenuAction = (
    item: ResolvedMobileMenuItem,
    guestLabel: string,
  ): { label: string; href?: string; onClick?: () => void } => {
    if (item.kind === 'search') {
      return { label: item.label, onClick: onOpenSearch };
    }
    if (item.kind === 'account') {
      return {
        label: signedIn ? item.label : guestLabel,
        href: signedIn ? '/account/profile' : '/login',
      };
    }
    return { label: item.label, href: item.href ?? '#' };
  };

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
          // Fades as the sheet is dragged away, so the page behind comes back
          // under the finger instead of after it.
          opacity: open ? 1 - drag.progress : 0,
          transition: drag.dragging
            ? 'none'
            : 'opacity 400ms var(--mr-ease-snappy), backdrop-filter 400ms ease',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
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
          transform: open ? `translateY(${Math.max(drag.offset, 0)}px)` : 'translateY(100%)',
          // No transition mid-drag: the sheet must track the finger exactly.
          // It comes back for the release, which is what makes both the snap
          // back and the slide out feel like the same object.
          transition: drag.dragging ? 'none' : `transform 600ms ${SHEET_EASE}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header — grabber, title/back, close. This whole strip is the drag
            handle, not just the pill: a 4px-tall target is a decoration, and
            the thumb aims at the top of the sheet, not at the pill. */}
        <div
          {...drag.handleProps}
          style={{
            position: 'relative',
            flex: '0 0 auto',
            padding: '18px 20px 12px',
            ...drag.handleProps.style,
          }}
        >
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
            {current ? (
              <button
                type="button"
                onClick={back}
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
                {current.label}
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

        {/* Panels — every level drilled into this session stays mounted so
            transforms transition smoothly in both directions; only the
            level count (drillPath.length) changes which one is active. */}
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <DrillPanel
            depth={0}
            activeDepth={drillPath.length}
            reducedMotion={reducedMotion}
            skipEnterAnimation
          >
            {/* Shortcut row — icon + text tiles, fully admin-configured. A
                text-only list makes the most-used actions look like menu
                items rather than the controls they are. */}
            {mobileMenu.shortcuts.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${mobileMenu.shortcuts.length}, 1fr)`,
                  gap: 10,
                  marginBottom: 20,
                  opacity: open && !current ? 1 : 0,
                  transform: open && !current ? 'translateY(0)' : 'translateY(20px)',
                  transition: ITEM_TRANSITION,
                  transitionDelay: open ? itemDelay(0) : '0ms',
                }}
              >
                {mobileMenu.shortcuts.map((s) => {
                  const action = resolveMobileMenuAction(s, 'Sign in');
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
                        {action.label}
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
                  return action.href ? (
                    <Link
                      key={s.id}
                      href={action.href}
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
                        action.onClick?.();
                      }}
                      data-trace-id={`PG-STOREFRONT-NAV-001::EL-BTN-mobile-nav-shortcut@${s.id}`}
                      style={style}
                    >
                      {inner}
                    </button>
                  );
                })}
              </div>
            )}

            {navbar.items.map((item, i) => (
              <MobileNavRow
                key={item.id}
                item={item}
                index={i + 1}
                revealed={open && !current}
                onDrill={() => drillInto(item)}
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
          </DrillPanel>

          {drillPath.map((item, depth) => (
            <DrillPanel
              key={item.id}
              depth={depth + 1}
              activeDepth={drillPath.length}
              reducedMotion={reducedMotion}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {(item.children ?? []).map((child, i) => (
                  <div key={child.id} style={{ gridColumn: '1 / -1' }}>
                    <MobileNavRow
                      item={child}
                      index={i}
                      revealed={depth + 1 === drillPath.length}
                      onDrill={() => drillInto(child)}
                      onClose={onClose}
                    />
                  </div>
                ))}
                {panelProducts(item).map((product, i) => (
                  <NavProductTile
                    key={product.id}
                    product={product}
                    index={(item.children?.length ?? 0) + i}
                    revealed={depth + 1 === drillPath.length}
                    onNavigate={onClose}
                  />
                ))}
              </div>

              <Link
                href={item.href}
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
                  opacity: depth + 1 === drillPath.length ? 1 : 0,
                  transform: depth + 1 === drillPath.length ? 'translateY(0)' : 'translateY(20px)',
                  transition: ITEM_TRANSITION,
                  transitionDelay:
                    depth + 1 === drillPath.length
                      ? itemDelay((item.children?.length ?? 0) + panelProducts(item).length)
                      : '0ms',
                }}
              >
                All {item.label}
                <span className="mr-link-arrow">→</span>
              </Link>
            </DrillPanel>
          ))}
        </div>

        {/* Footer bar — the optional pinned button + socials, in a bar that
            survives scrolling. Socials are pinned here (not in the scrolling
            panel above) so they never scroll away with the category list. */}
        <div
          style={{
            flex: '0 0 auto',
            borderTop: '1px solid var(--mr-hairline)',
            background: 'var(--mr-cream-200)',
            padding: '14px 20px calc(14px + env(safe-area-inset-bottom))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: mobileMenu.footerButton ? 'space-between' : 'flex-end',
            gap: 16,
          }}
        >
          {mobileMenu.footerButton &&
            (() => {
              const footerItem = mobileMenu.footerButton;
              const action = resolveMobileMenuAction(footerItem, 'Login');
              const style: React.CSSProperties = {
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
                border: 0,
                cursor: 'pointer',
              };
              const inner = (
                <>
                  <Icon name={footerItem.icon} size={16} />
                  {action.label}
                </>
              );
              return action.href ? (
                <Link
                  href={action.href}
                  onClick={onClose}
                  data-trace-id="PG-STOREFRONT-NAV-001::EL-LINK-mobile-nav-footer-button"
                  style={style}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    action.onClick?.();
                  }}
                  data-trace-id="PG-STOREFRONT-NAV-001::EL-BTN-mobile-nav-footer-button"
                  style={style}
                >
                  {inner}
                </button>
              );
            })()}

          <div
            data-trace-id="PG-STOREFRONT-NAV-001::EL-REGION-mobile-nav-socials"
            style={{ display: 'flex', gap: 14 }}
          >
            {socials.map((s) => (
              <AnimatedSocialLink key={s.id} network={s.network} url={s.url} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** One panel of the drill stack: `depth` 0 is the root list, `depth` N is N
 *  levels into the drill. `activeDepth` is the shopper's current position —
 *  this panel is "current" when it equals `depth`, is the settling parent
 *  when it is one level shallower, and is otherwise parked out of view. A
 *  brand-new panel (freshly pushed by drilling in) starts at translateX(100%)
 *  and is flipped to its resting transform one frame later so the browser
 *  actually paints the starting position before the transition begins —
 *  without that, the very first frame already shows the resting value and no
 *  slide-in plays at all. `skipEnterAnimation` is for the root panel, which
 *  is never "entered" — it exists from the moment the sheet mounts. */
function DrillPanel({
  depth,
  activeDepth,
  reducedMotion,
  skipEnterAnimation,
  children,
}: {
  depth: number;
  activeDepth: number;
  reducedMotion: boolean;
  skipEnterAnimation?: boolean;
  children: React.ReactNode;
}) {
  const [entered, setEntered] = React.useState(Boolean(skipEnterAnimation));
  React.useEffect(() => {
    if (entered) return;
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isActive = depth === activeDepth;
  const isSettlingParent = depth === activeDepth - 1;

  // Before the first paint has happened, force the off-screen starting
  // position regardless of active/parent state — see the comment above.
  const translateX = !entered ? 100 : isActive ? 0 : -30;

  return (
    <div
      aria-hidden={!isActive}
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '4px 20px 20px',
        transform: `translateX(${translateX}%)`,
        opacity: !entered || isActive || isSettlingParent ? 1 : 0,
        pointerEvents: isActive ? 'auto' : 'none',
        // The panel that just took over gets the higher z-index, per the
        // owner's spec — depth alone gives that ordering for free.
        zIndex: depth,
        transition: reducedMotion ? 'none' : `transform ${DRILL_DURATION_MS}ms ${DRILL_EASE}`,
      }}
    >
      {children}
    </div>
  );
}

/** One row: a link, or a drill-down trigger when the item has real
 *  subcategories or pinned products. Used for both the root nav list and
 *  every nested drill panel — a resolved child has the same shape as a
 *  top-level nav item. */
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
  const hasPanel = canDrill(item);

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

/**
 * A social icon, coloured for its network and animated on tap — press-in
 * then a springy release, built from `lib/motion/presets.ts`'s `MR_SPRING`
 * configs (a fast 'interactive' spring for the press, a bouncier 'bouncy'
 * spring for the release) rather than a bespoke transition. Pointer events
 * (not click) so the animation starts the instant a finger lands, not after
 * it lifts.
 */
function AnimatedSocialLink({ network, url }: { network: SocialNetwork; url: string }) {
  const [pressed, setPressed] = React.useState(false);
  const scale = useSpringValue(pressed ? 0.82 : 1, pressed ? 'interactive' : 'bouncy', [pressed]);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={network}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'inline-flex',
        transform: `scale(${scale})`,
      }}
    >
      <SocialIcon network={network} variant="brand" />
    </a>
  );
}
