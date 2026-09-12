'use client';

import React from 'react';
import GenericAvatarIcon from '@/components/ui/GenericAvatarIcon';
import RemoteImage from '@/components/ui/RemoteImage';
import { useCustomerProfile } from '@/lib/hooks/use-customer';
import { useUser } from '@/lib/hooks/use-auth';
import { openMobileMenu } from '@/lib/hooks/useMobileChrome';

/**
 * The one way into the account, on every surface.
 *
 * There used to be three different doors and none of them looked alike: a
 * hamburger at the top-left on a phone, the words "HI, RAWAN" on a laptop, and
 * an avatar in the bottom nav. The owner asked for one recognisable control
 * (2026-08-21): "unify menu to be same icon profile ... so when a user taps on
 * his icon profile the menu slider pops up ... and remove menu from navbar,
 * just move it there on profile icon."
 *
 * A face is a better affordance than three lines or a greeting: it is the only
 * element on the bar that is about YOU, it survives translation, and it does not
 * grow with the length of a name — "HI, RAWAN" and "HI, ABDELRAHMAN" pushed the
 * cart button to two different places.
 *
 * The photo comes from `customer_profiles.avatar_url` — never `users.avatar_url`,
 * which is staff — and falls back to the shared silhouette. Never an initial
 * letter; that is a storefront-wide rule and the bottom nav already obeys it.
 */
export default function AccountAvatarButton({
  size = 40,
  tone = 'cream',
  label = 'Account and menu',
  onClick,
  traceId,
}: {
  size?: number;
  tone?: 'cream' | 'glass';
  label?: string;
  /**
   * What the avatar opens. Defaults to the menu sheet, which is what the phone
   * wants and what replaced the hamburger. The desktop header passes its own
   * handler so the avatar toggles the identity dropdown that already lives
   * beside it — same control, same meaning, the surface decides the surface's
   * own disclosure.
   */
  onClick?: () => void;
  traceId?: string;
}) {
  const { data: authUser } = useUser();
  // Gated on being signed in — the same guard MobileBottomNav uses, so a
  // guest never fires a profile request just to render a silhouette.
  const { data: customerProfile } = useCustomerProfile({ enabled: !!authUser });

  const isSignedIn = !!authUser;
  const avatarUrl = isSignedIn ? (customerProfile?.avatarUrl ?? null) : null;

  // A replaced photo lands on a fresh key and its first request is a cold miss
  // all the way through the image pipeline; one failure must fall back to the
  // silhouette rather than leave a broken frame in the header.
  const [errored, setErrored] = React.useState(false);
  React.useEffect(() => setErrored(false), [avatarUrl]);
  const showPhoto = !!avatarUrl && !errored;

  const glyph = size - 20;

  return (
    <button
      type="button"
      onClick={onClick ?? openMobileMenu}
      aria-label={label}
      data-trace-id={traceId}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        cursor: 'pointer',
        flexShrink: 0,
        overflow: 'hidden',
        border:
          tone === 'glass'
            ? '1px solid rgba(253,251,245,0.28)'
            : '1px solid var(--mr-hairline)',
        background:
          tone === 'glass' ? 'rgba(253,251,245,0.12)' : 'var(--mr-cream-100)',
        color: 'inherit',
        transition:
          'background-color var(--mr-dur-fast) var(--mr-ease-snappy), transform var(--mr-dur-fast) var(--mr-ease-spring)',
      }}
    >
      {showPhoto && avatarUrl ? (
        // Through Next's optimizer (#11): the avatar URL is one fixed
        // imgproxy render at `dpr:2/q:95`, so a raw tag downloaded a
        // several-hundred-KB JPEG to paint a 40px circle on every page of the
        // site. `RemoteImage` asks for a 2x ladder of THIS size in AVIF, and
        // still falls back to the plain tag before it gives up on the photo.
        <RemoteImage
          src={avatarUrl}
          alt=""
          width={size}
          height={size}
          data-testid="account-avatar-photo"
          onError={() => setErrored(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <GenericAvatarIcon size={glyph} />
      )}
    </button>
  );
}
