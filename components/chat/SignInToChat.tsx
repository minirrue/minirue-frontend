'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
 */
export default function SignInToChat() {
  const pathname = usePathname();
  const next = encodeURIComponent(pathname || '/');

  return (
    <div
      style={{
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
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
      <div style={{ display: 'flex', gap: 'var(--mr-sp-3)', flexWrap: 'wrap' }}>
        <Link
          href={`/login?next=${next}&reason=sign-in-required`}
          className="mr-btn mr-btn--primary"
          style={{ textDecoration: 'none' }}
        >
          Sign in
        </Link>
        <Link
          href={`/signup?next=${next}`}
          style={{
            alignSelf: 'center',
            color: 'var(--mr-fg-2)',
            fontSize: 14,
          }}
        >
          Create an account
        </Link>
      </div>
    </div>
  );
}
