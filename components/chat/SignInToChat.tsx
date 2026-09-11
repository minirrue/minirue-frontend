'use client';

import { usePathname } from 'next/navigation';
import Button from '@/components/ui/Button';

/**
 * What a guest sees instead of the chat.
 *
 * Owner decision 2026-07-29: messaging needs an account. A guest thread has no
 * account behind it to reply to, and the guest→customer merge that existed to
 * paper over that was doing a lot of quiet work for a case that should not
 * arise.
 *
 * The launcher bubble stays visible. Hiding it would remove the affordance
 * rather than explain it — someone looking for help would conclude there is no
 * support at all, which is worse than being asked to sign in.
 *
 * Returns them here afterwards, so signing in does not cost them the page they
 * were reading.
 *
 * Both actions are the shared `Button` (#9). They were a `<Link>` carrying
 * `className="mr-btn mr-btn--primary"` and a bare text link — and `.mr-btn` is
 * not defined in any stylesheet in this repo, so BOTH rendered as plain text
 * with no fill, border or elevation. The class names read as correct at the
 * call site and did nothing, which is why this looked like a styling choice
 * rather than a missing one.
 */
export default function SignInToChat() {
  const pathname = usePathname();
  const next = encodeURIComponent(pathname || '/');

  return (
    <div
      style={{
        // Fills the panel and centres in it. The prompt used to sit at the top
        // of a full-height box with a large empty expanse under it, which read
        // as still loading rather than as a finished screen.
        flex: 1,
        minHeight: 0,
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 'var(--mr-sp-4)',
        alignItems: 'flex-start',
      }}
      data-trace-id="PG-STOREFRONT-SUPPORT-001::EL-REGION-sign-in-to-chat"
    >
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--mr-font-serif)',
          fontSize: 'var(--mr-text-lg)',
          lineHeight: 1.3,
        }}
      >
        Sign in to message us
      </p>
      <p style={{ margin: 0, color: 'var(--mr-fg-3)', fontSize: 14, lineHeight: 1.5 }}>
        Your conversation stays with your account, so you can pick it up again
        from any device — and we know who we&apos;re replying to.
      </p>
      {/*
        One primary, one secondary — signing in is the expected action and
        creating an account is the way out for someone who cannot.

        They wrap rather than shrink: the panel is `min(360px, 100vw - 48px)`
        wide, so on a narrow phone two pills side by side would squeeze both
        below a comfortable target.
      */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--mr-sp-3)',
          flexWrap: 'wrap',
          width: '100%',
        }}
      >
        <Button
          href={`/login?next=${next}&reason=sign-in-required`}
          variant="primary"
          // 44px is the floor for a touch target; the shared button's `md`
          // padding lands at 40.
          style={{ minHeight: 44 }}
          traceId="PG-STOREFRONT-SUPPORT-001::EL-BTN-sign-in-to-chat"
        >
          Sign in
        </Button>
        <Button
          href={`/signup?next=${next}`}
          variant="outline"
          style={{ minHeight: 44 }}
          traceId="PG-STOREFRONT-SUPPORT-001::EL-BTN-create-account-from-chat"
        >
          Create an account
        </Button>
      </div>
    </div>
  );
}
