'use client';

import type { CSSProperties } from 'react';

/**
 * The one generic-profile silhouette used wherever a person's photo is
 * missing. Extracted from the admin dashboard's Settings profile card (the
 * exact shape the owner picked — apps/minirue-dashboard's
 * `SettingsClient.tsx` AdminProfileCard, and its own
 * `components/GenericAvatarIcon.tsx`), so the storefront's "no photo" state
 * reads as the same icon a shopper would see used consistently across
 * MiniRue's apps, not a different glyph or an initial letter.
 *
 * Renders at a size relative to its parent by default (percentage), since
 * every avatar slot that uses this already centers/clips its children to a
 * circle — see the account page's avatar tile.
 */
export default function GenericAvatarIcon({
  size = '55%',
  className,
  style,
}: {
  size?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      data-testid="avatar-generic"
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="No photo"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
