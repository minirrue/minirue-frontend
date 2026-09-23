'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Wordmark from '@/components/ui/Wordmark';
import IconButton from '@/components/ui/IconButton';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import { useScrollDirection } from '@/lib/hooks/useScrollDirection';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { useMobileChrome, closeMobileMenu, closeMobileSearch, openMobileSearch } from '@/lib/hooks/useMobileChrome';
import { getSession, type Session } from '@/lib/session';
import { useUser, useLogout } from '@/lib/hooks/use-auth';
import { useSessionState } from '@/lib/hooks/use-session-state';
import { useCustomerProfile } from '@/lib/hooks/use-customer';
import { useIdleImport } from '@/lib/hooks/useIdleImport';
import { useStorefrontChrome } from '@/lib/hooks/use-storefront';
import { usePreviewId } from '@/lib/hooks/storefront-preview';
import {
  FALLBACK_CHROME,
  type ResolvedChrome,
  type ResolvedNavItem,
} from '@/lib/api/storefront';
import AccountAvatarButton from '@/components/layout/AccountAvatarButton';
import { SHOP_ROOT } from '@/lib/routes';

interface HeaderProps {
  navbar: ResolvedChrome['navbar'];
  onOpenCart?: () => void;
  cartCount?: number;
  transparent?: boolean;
}

/** Hover intent: opening on the first pixel makes the menu fire while the
 *  pointer is only passing through; closing on the first pixel out makes the
 *  gap between the link and the panel a dead zone. */
const HOVER_OPEN_MS = 90;
const HOVER_CLOSE_MS = 220;

/**
 * How long the bar takes to slide off the top, and — the reason it is a
 * constant rather than a literal buried in the transition string — the floor
 * for how long `useScrollDirection` must refuse to reverse its mind.
 *
 * #51: the owner reported the bar "flashes many times under one second" on a
 * slow scroll. Part of that is the hook's thresholds (fixed there), but part is
 * structural: a bar asked to reverse while this transition is still running can
 * only stutter. The two numbers have to move together, so they are one number.
 * `HIDE_FLIP_COOLDOWN_MS` is deliberately LONGER than the transition so the
 * animation always lands before anything can ask for the opposite.
 */
const HIDE_TRANSITION_MS = 280;
const HIDE_FLIP_COOLDOWN_MS = HIDE_TRANSITION_MS + 40;

/*
 * The ONE navigation list this header knows about: `navbar.items`, exactly as
 * the dashboard's Navigation tab saved it. The desktop `<nav>` below and the
 * `navbar` handed to `MobileNavSheet` are the same array, so anything on one
 * is on the other by construction.
 *
 * NOTHING IS HARDCODED HERE. Shop used to be prepended as a fixed link
 * (`FIXED_NAV_LINKS`) that the owner could not rename, move or remove. Owner,
 * 2026-09-23: "make shop not constant but dynamic in desktop navbar … same
 * goes to fully control on mobile navbar" (#197). It is now an ordinary saved
 * item (`{ kind: 'link', label: 'Shop', href: '/shop' }`), seeded into the live
 * layout before this change so the bar never lost it. The trust pages went the
 * same way on 2026-09-21: "don't make anything static but beautifully ux ui
 * dynamically controlled from dashboard."
 *
 * Navigation is content: a list in storefront source can't be changed without
 * a developer and a deploy, and it goes stale the day a page is renamed.
 */

/**
 * The search sheet, mobile menu sheet and desktop category dropdown are all
 * closed on arrival, so they load after the page has (#76) — module-level so
 * it is a stable cache key across the Header every page builds for itself.
 */
const loadHeaderSheets = () => import('@/components/layout/header-sheets');

export default function Header({ navbar, onOpenCart, cartCount = 0, transparent = false }: HeaderProps) {
  // `mobileOpen`/`searchOpen` used to be local useState here — but W4a.2's
  // bottom nav needs to open the SAME sheets from a completely separate
  // React subtree (it's mounted once in app/layout.tsx, not inside this
  // component), so both now read from the shared useMobileChrome store
  // instead. Header keeps ownership of actually RENDERING the sheets below;
  // only the open/closed booleans moved.
  const { menuOpen: mobileOpen, searchOpen } = useMobileChrome();
  const [hoveredNavId, setHoveredNavId] = React.useState<string | null>(null);
  const [bump, setBump] = React.useState(false);
  const [session, setSession] = React.useState<Session | null>(null);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const prevCount = React.useRef(cartCount);
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const logoutMutation = useLogout();
  const { data: authUser } = useUser();
  /**
   * Who the header renders for.
   *
   * This used to be `authRefused ? null : session` — `isError` from useUser(),
   * gating the `mr-session` localStorage snapshot. Two things were wrong with
   * it, in opposite directions:
   *
   *   - `isError` is true on ANY failed attempt, not only a refusal. useUser()
   *     is `retry: false` with a 15-minute staleTime, so one unreachable
   *     `/auth/me` — a blip, a request killed by a navigation — dropped the
   *     greeting and the account menu for a shopper whose session was perfectly
   *     alive. Telling a signed-in customer they are signed out is its own bug.
   *   - `session` is a snapshot taken at sign-in that nothing revokes, so
   *     whenever the query had not yet errored it outlived the session it
   *     describes.
   *
   * `useSessionState()` answers both: it fails closed only on a SETTLED 401 (or
   * a local sign-out), and it never fails closed on a transient failure. It is
   * the same rule the support widget already used, and now the only one.
   * Trace: `docs/superpowers/runbooks/auth-state-map.md`.
   */
  const { isSignedIn } = useSessionState();
  const identity = isSignedIn ? session : null;
  // Only fetched once signed in — a guest on the storefront would otherwise
  // fire an authenticated request on every page that can only come back 401.
  const { data: customerProfile } = useCustomerProfile({ enabled: Boolean(identity) });
  // The mobile sheet's footer account button shows the shopper's first name
  // in place of its admin-configured label once signed in — reusing the same
  // chain AccountIdentityStrip.tsx already settled on for the account page
  // (profile display name, then profile first name, then the account name,
  // then — nowhere else on this compact button is the email shown — its
  // local-part), just trimmed to a single word since a full name is what
  // AccountIdentityStrip shows, not what a thumb-width pill button has room
  // for. `undefined` (not the literal word "Member") when nothing resolves
  // yet, so the button falls back to the admin's own label instead of ever
  // rendering a resolved-but-empty string.
  const accountDisplayName =
    customerProfile?.displayName?.trim() ||
    customerProfile?.firstName?.trim() ||
    authUser?.name?.trim().split(' ')[0] ||
    authUser?.email?.split('@')[0] ||
    undefined;
  const { mobile, tablet, w } = useBreakpoint();
  // Socials for the mobile sheet's footer bar. Read from the same cached chrome
  // query the page already resolved, so this costs no extra request; an empty
  // list simply renders no icons.
  const { data: chrome } = useStorefrontChrome();
  const socials = chrome?.footer.socials ?? [];
  const mobileMenu = chrome?.mobileMenu ?? FALLBACK_CHROME.mobileMenu;
  // The ONE shop name (2026-07-31 owner ask) — never the hardcoded "MiniRue"
  // literal the wordmark used to render. Deliberately name ONLY: `chrome`
  // also carries `shopLogoUrl`, and this file used to read it and render it
  // beside the wordmark, which put two marks in the header saying the same
  // thing (owner: "we have now 2 logo ... remove the upaloded one", ce69056).
  // The uploaded logo's home is the shop panel (app/categories) and the chat
  // avatar — not here. Do not reintroduce a `shopLogoUrl` binding.
  const shopName = chrome?.shopName ?? FALLBACK_CHROME.shopName;
  // Draft-preview tag (#193) for the bar AND the phone menu sheet: the sheet
  // lists the same navbar items. Undefined, so absent, on the live shop.
  const previewId = usePreviewId('navbar');

  // Single scroll subscription, rAF-throttled, shared with MobileBottomNav —
  // replaces the old unthrottled `scroll` listener this file used to attach
  // just to compute `scrolled`.
  // The cooldown is pinned to this header's own transition duration (see
  // HIDE_FLIP_COOLDOWN_MS) rather than left at the hook's default, so the two
  // cannot drift apart if someone retunes the slide. Thresholds stay at the
  // hook's defaults — decisive to hide, eager to reveal; see #51.
  const { direction, atTop } = useScrollDirection({ cooldownMs: HIDE_FLIP_COOLDOWN_MS });
  const reducedMotion = usePrefersReducedMotion();
  /**
   * "Has this page been scrolled?" — the switch between the roomy transparent
   * treatment over a hero and the compact solid one.
   *
   * #61: this was `y > 60`, a bare comparison on the raw scroll offset, and it
   * was the bug the owner was still seeing near the top. It had no threshold,
   * no hysteresis and no cooldown — none of the machinery #51 built, because
   * none of that machinery is on `y`; it is on `direction`, and this never
   * asked about direction. A slow drag from the top rolls back ~11px every few
   * frames (a 2mm thumb tremor — see useScrollDirection), so the page crosses
   * y=60 and re-crosses it perhaps ten times on the way past, and every single
   * crossing restarted the 360ms background/border/colour transition and the
   * padding jump below. Measured on the production build: NINE changes over one
   * slow 0 -> 120px drag (e2e/storefront/mobile-scroll-stability.spec.ts).
   *
   * `atTop` is the same question already answered properly. It is hysteretic —
   * in at 4px, out at 60px — so the 60px boundary is crossed once and the way
   * back to transparent is the page actually returning to the top, which is
   * when a hero header should be transparent anyway. One gesture, one change.
   */
  const scrolled = !atTop;
  // Below 1024px only — desktop has no bottom bar to hand the edge to, so the
  // top bar always stays put there. `w > 0` guards the one SSR/pre-hydration
  // frame where `tablet` would otherwise read false-positive as "desktop".
  const belowBreakpoint = w > 0 && tablet;
  /**
   * #61 also asked whether the bar should simply refuse to hide below some
   * fixed offset. It does now, but as a consequence rather than a second magic
   * number: `atTop` holds for the first 60px, and while it holds the hook pins
   * its anchor to the current position, so the 56px of decisive downward travel
   * that a hide costs is measured from the moment the band is left — the
   * earliest the bar can go is ~116px, not the ~56px it used to be. No
   * discontinuity, no offset to keep in sync with the band, and one gesture
   * still hides it.
   */
  const hideForScroll = belowBreakpoint && !atTop && direction === 'down';

  // Re-read whenever the auth answer moves, not once at mount. Every
  // sign-out path clears `mr-session`, but this component is not remounted by
  // a client-side navigation, so a sign-out from the account page or a
  // server-side revocation left the stale snapshot on screen indefinitely.
  React.useEffect(() => {
    setSession(getSession());
  }, [authUser, isSignedIn]);

  // Cross-tab. Removing a localStorage key fires `storage` in every OTHER
  // tab — for free, no BroadcastChannel — so a sign-out in one tab drops this
  // tab's greeting immediately instead of at its next navigation.
  React.useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'mr-session') setSession(getSession());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  React.useEffect(() => {
    if (cartCount > prevCount.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 450);
      prevCount.current = cartCount;
      return () => clearTimeout(t);
    }
    prevCount.current = cartCount;
  }, [cartCount]);

  React.useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);

  const scheduleHover = (id: string | null, delay: number) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoveredNavId(id), delay);
  };

  /**
   * The admin's saved list, which BOTH the desktop bar and the mobile sheet
   * render (see the note above the component).
   */
  const navItems = navbar.items;
  /** Only category items the admin pinned products to open a panel. */
  const panelItems = React.useMemo(
    () => navItems.filter((i) => (i.featured?.length ?? 0) > 0),
    [navItems],
  );
  const hoveredItem: ResolvedNavItem | null =
    panelItems.find((i) => i.id === hoveredNavId) ?? null;
  const { mod: sheets, armed: sheetsArmed } = useIdleImport(
    loadHeaderSheets,
    searchOpen || mobileOpen || hoveredItem !== null,
  );
  const SearchSheet = sheets?.SearchSheet;
  const MobileNavSheet = sheets?.MobileNavSheet;
  const NavCategorySheet = sheets?.NavCategorySheet;

  const closeDropdown = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoveredNavId(null);
  };

  // The dropdown is a cream panel; a transparent header sitting on top of it
  // would render its links cream-on-cream. Opening one forces the solid state.
  const isLight = transparent && !scrolled && hoveredItem === null;

  return (
    <>
      <header
        data-testid="site-header"
        data-preview-id={previewId}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: isLight ? 'transparent' : 'rgba(246,242,233,0.93)',
          backdropFilter: isLight ? 'none' : 'blur(18px)',
          WebkitBackdropFilter: isLight ? 'none' : 'blur(18px)',
          borderBottom: isLight ? '1px solid transparent' : '1px solid var(--mr-hairline)',
          color: isLight ? 'var(--mr-cream-100)' : 'var(--mr-ink-900)',
          // W4a.2: below 1024px, scrolling down slides the top bar out (and
          // MobileBottomNav slides in to take its place); scrolling up — or
          // being near the very top — reverses it. `transform`, never `top`,
          // so this never fights the header's own `position: sticky`, and no
          // `position:fixed` descendant of <header> exists for this to break
          // (SearchSheet/MobileNavSheet render as siblings below, not inside
          // it — see the render return further down).
          transform: hideForScroll ? 'translateY(-100%)' : 'translateY(0)',
          transition: reducedMotion
            ? 'background 360ms var(--mr-ease-out), border-color 360ms var(--mr-ease-out), color 360ms var(--mr-ease-out)'
            : `background 360ms var(--mr-ease-out), border-color 360ms var(--mr-ease-out), color 360ms var(--mr-ease-out), transform ${HIDE_TRANSITION_MS}ms var(--mr-ease-out)`,
        }}
      >
        <div
          className="mr-header-inner"
          style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '44px minmax(0, 1fr) 44px' : 'minmax(0, 1fr) auto minmax(0, 1fr)',
            alignItems: 'center',
            // CONSTANT — deliberately no longer keyed to `scrolled`.
            //
            // This used to shrink from 22px to 14px (desktop) and 16px to
            // 10px (mobile) once scrolled. The header is `position: sticky`,
            // so it is IN FLOW and has no fixed height: shrinking its padding
            // shrinks the header, which shortens the document and drags every
            // section below it upward. Measured on production: header
            // 89px -> 73px and document 2438 -> 2422 between scrollY 0 and
            // 104 — a 16px lurch, smeared over 320ms by the padding
            // transition and amplified by Lenis, which is exactly the "whole
            // page shrinks up with it" the owner reported (2026-09-21).
            //
            // The roomy value is the one kept, so the top of every page looks
            // exactly as it did; only the scrolled state is now the same
            // height instead of 16px shorter. `scrolled` still drives the
            // background, border and colour transitions below — those cost
            // no layout.
            //
            // Keep in sync with `--mr-header-h` in app/styles/mr-tokens.css,
            // which the product gallery sizes itself against.
            padding: mobile ? '16px 16px' : '22px 48px',
            maxWidth: 1440,
            margin: '0 auto',
          }}
        >
          {/* Left: nav on a laptop, the account avatar on a phone.
              The hamburger is gone — one recognisable door into the menu and
              the account, and it is the avatar (owner, 2026-08-21). It opens
              exactly the sheet the hamburger used to. */}
          {mobile ? (
            <AccountAvatarButton
              size={40}
              tone={isLight ? 'glass' : 'cream'}
              traceId="PG-STOREFRONT-IAM-006::EL-BTN-account-menu-trigger-mobile"
            />
          ) : (
            <nav
              style={{
                display: 'flex',
                // Wraps rather than overflows. This column is a
                // `minmax(0, 1fr)` grid track, so between 640px (where the
                // phone layout ends) and ~1024px there is only a couple of
                // hundred pixels for it — and this bar is no longer one fixed
                // link plus whatever the admin curated: it now also carries
                // the trust pages, so a no-wrap row could run under the
                // wordmark on a small laptop. A second line is the honest
                // failure mode; a clipped or overflowing one is not.
                flexWrap: 'wrap',
                // Column gap unchanged at 28px. The row gap is tighter so a
                // wrapped second line reads as one block rather than two bars.
                columnGap: 28,
                rowGap: 10,
                fontFamily: 'Jost, sans-serif',
                fontSize: 12,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
              }}
            >
              {/* ONE list — `navItems`, the admin's saved items — and the
                  mobile sheet below is handed the same one (#197). */}
              {navItems.map((item) => {
                const hasPanel = (item.featured?.length ?? 0) > 0;
                const style: React.CSSProperties = {
                  color: 'inherit',
                  textDecoration: 'none',
                  cursor: 'pointer',
                };
                // `onMouseLeave` is on EVERY item, panel or not: moving onto a
                // plain link has to close a panel that a neighbour opened.
                const hover = {
                  onMouseEnter: () => scheduleHover(hasPanel ? item.id : null, HOVER_OPEN_MS),
                  onMouseLeave: () => scheduleHover(null, HOVER_CLOSE_MS),
                };
                if (hasPanel) {
                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      className="mr-nav-link"
                      aria-expanded={hoveredNavId === item.id}
                      {...hover}
                      // Keyboard users get the same panel: focusing the link opens it,
                      // Escape closes it without leaving the link.
                      onFocus={() => setHoveredNavId(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') closeDropdown();
                      }}
                      style={style}
                    >
                      {item.label}
                    </a>
                  );
                }
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="mr-nav-link"
                    // Every shop route is dynamic, so the default prefetch
                    // stops at the loading boundary and a tap would still pay
                    // a full round trip (see ShopRouteSkeleton). One link is a
                    // bounded cost for the thing people click most — and only
                    // that one: prefetching four trust pages nobody has asked
                    // for would spend a phone's data on documents most
                    // shoppers never open.
                    prefetch={item.href === SHOP_ROOT}
                    {...hover}
                    style={style}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Center: the Wordmark alone, linking home.
              The uploaded brand logo is deliberately NOT rendered here. It was,
              briefly, and the result was two marks side by side in the header —
              the wordmark and the uploaded image saying the same thing twice
              (owner, 2026-07-31: "we have now 2 logo ... remove the upaloded
              one"). The uploaded logo belongs on the shop panel, the way a
              partner's logo appears on their own space page — not in the
              header, where the wordmark is already the shop's identity. */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Link
              href="/"
              aria-label={`${shopName} — home`}
              data-trace-id="PG-STOREFRONT-HOME-001::EL-LINK-wordmark-home"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}
            >
              <Wordmark
                size={mobile ? 18 : 22}
                color={isLight ? 'var(--mr-cream-100)' : 'var(--mr-gold-500)'}
                captionColor={isLight ? 'rgba(253,251,245,0.65)' : 'var(--mr-ink-500)'}
                text={shopName}
              />
            </Link>
          </div>

          {/* Right: Icons */}
          <div
            style={{
              display: 'flex',
              gap: mobile ? 6 : 10,
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            {/* Search — now in the bar on phones too. It opens a sheet rather
                than navigating, so it costs no page load; burying the single
                most-used control one tap deep inside the hamburger was the
                wrong trade on a mobile-first storefront. */}
            <IconButton
              icon="search"
              label="Search"
              tone={isLight ? 'glass' : 'cream'}
              onClick={openMobileSearch}
            />
            <IconButton
              icon="bag"
              label="Bag"
              tone={isLight ? 'glass' : 'cream'}
              onClick={onOpenCart}
              badge={cartCount}
              badgeBump={bump}
            />
            {/* Account — LAST, after the bag: search, cart, then you
                (owner, 2026-08-21). On a phone the same account door sits at
                the top-left of the bar instead. */}
            {!mobile && (
              identity ? (
                <div style={{ position: 'relative' }}>
                  <AccountAvatarButton
                    size={40}
                    tone={isLight ? 'glass' : 'cream'}
                    label={`Account menu for ${(authUser?.name ?? identity.name)?.split(' ')[0] || 'you'}`}
                    onClick={() => setAccountOpen((o) => !o)}
                    traceId="PG-STOREFRONT-IAM-006::EL-BTN-account-menu-trigger"
                  />
                  {accountOpen && (
                    <div
                      data-trace-id="PG-STOREFRONT-IAM-006::EL-MENU-account-dropdown"
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        background: 'var(--mr-cream-100)',
                        border: '1px solid var(--mr-hairline)',
                        borderRadius: 'var(--mr-radius-md)',
                        boxShadow: 'var(--mr-shadow-lg)',
                        minWidth: 160,
                        zIndex: 100,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '14px 18px',
                          borderBottom: '1px solid var(--mr-hairline)',
                          background: 'var(--mr-bg-raised)',
                        }}
                      >
                        <p
                          style={{
                            margin: '0 0 6px',
                            fontFamily: 'Cormorant Garamond, serif',
                            fontSize: 16,
                            color: 'var(--mr-ink-900)',
                          }}
                        >
                          {authUser?.name ?? identity.name}
                        </p>
                        <p
                          style={{
                            margin: '0 0 10px',
                            fontSize: 11,
                            color: 'var(--mr-ink-500)',
                          }}
                        >
                          {authUser?.email ?? identity.email}
                        </p>
                        {/* No role badge. Everyone who can see this menu is a
                            customer, so labelling them one is telling a shopper
                            something they already know in a word from our
                            internal vocabulary. */}
                      </div>
                      {[
                        { label: 'Account', href: '/account/profile' },
                        { label: 'Orders', href: '/account/orders' },
                      ].map(({ label, href }) => (
                        <Link
                          key={label}
                          href={href}
                          onClick={() => setAccountOpen(false)}
                          data-trace-id={`PG-STOREFRONT-IAM-006::EL-LINK-account-nav-item@${label.toLowerCase()}`}
                          style={{
                            display: 'block',
                            padding: '12px 18px',
                            fontFamily: 'Jost, sans-serif',
                            fontSize: 11,
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            color: 'var(--mr-ink-900)',
                            textDecoration: 'none',
                            borderBottom: '1px solid var(--mr-hairline)',
                          }}
                        >
                          {label}
                        </Link>
                      ))}
                      <div
                        role="button"
                        tabIndex={0}
                        aria-disabled={logoutMutation.isPending}
                        data-trace-id="PG-STOREFRONT-IAM-006::EL-BTN-sign-out-header"
                        onClick={() => {
                          // 2026-07-07 v5 §26 Rule 4 fix: was a parallel direct
                          // clearTokens() + clearSession() path. Now routes through
                          // useLogout() — the single source of truth for sign-out.
                          // onSuccess clears tokens, session, and queries; then we
                          // navigate to the storefront home per US-SHOPPER-IAM-003.
                          logoutMutation.mutate(undefined, {
                            onSuccess: () => {
                              setSession(null);
                              setAccountOpen(false);
                              router.push('/');
                            },
                            onError: () => {
                              setSession(null);
                              setAccountOpen(false);
                              router.push('/');
                            },
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            logoutMutation.mutate(undefined, {
                              onSuccess: () => {
                                setSession(null);
                                setAccountOpen(false);
                                router.push('/');
                              },
                              onError: () => {
                                setSession(null);
                                setAccountOpen(false);
                                router.push('/');
                              },
                            });
                          }
                        }}
                        style={{
                          padding: '12px 18px',
                          fontFamily: 'Jost, sans-serif',
                          fontSize: 11,
                          letterSpacing: '0.18em',
                          textTransform: 'uppercase',
                          color: 'var(--mr-ink-400)',
                          cursor: logoutMutation.isPending ? 'default' : 'pointer',
                          opacity: logoutMutation.isPending ? 0.6 : 1,
                        }}
                      >
                        {logoutMutation.isPending ? 'Signing out\u2026' : 'Sign out'}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  style={{
                    fontFamily: 'Jost, sans-serif',
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'inherit',
                    textDecoration: 'none',
                  }}
                >
                  Sign in
                </Link>
              )
            )}
          </div>
        </div>

        {/* Desktop category dropdown. Rendered inside <header> so it hangs off
            the sticky bar and travels with it; never on phones, where the
            bottom sheet owns the same content. */}
        {!mobile && panelItems.length > 0 && NavCategorySheet && (
          <NavCategorySheet
            item={hoveredItem}
            open={hoveredItem !== null && sheetsArmed}
            onMouseEnter={() => {
              if (hoverTimer.current) clearTimeout(hoverTimer.current);
            }}
            onMouseLeave={() => scheduleHover(null, HOVER_CLOSE_MS)}
            onNavigate={closeDropdown}
          />
        )}
      </header>

      {SearchSheet && (
        <SearchSheet
          open={searchOpen && sheetsArmed}
          onClose={closeMobileSearch}
          suggestions={navbar.items.map((i) => i.label)}
        />
      )}

      {/* Mobile nav — bottom sheet */}
      {mobile && MobileNavSheet && (
        <MobileNavSheet
          open={mobileOpen && sheetsArmed}
          onClose={closeMobileMenu}
          // The same `navbar` the desktop bar renders above — one list (#197).
          navbar={navbar}
          mobileMenu={mobileMenu}
          socials={socials}
          signedIn={Boolean(identity)}
          onOpenSearch={openMobileSearch}
          accountDisplayName={accountDisplayName}
          shopName={chrome?.shopName}
        />
      )}

    </>
  );
}
