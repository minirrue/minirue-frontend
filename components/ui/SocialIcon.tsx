import React from 'react';
import type { SocialNetwork } from '@/lib/api/storefront';

const LABELS: Record<SocialNetwork, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  x: 'X',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  pinterest: 'Pinterest',
};

/** One simple glyph per network. `currentColor` only — no icon library, no remote assets. */
const PATHS: Record<SocialNetwork, React.ReactNode> = {
  instagram: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" />
    </>
  ),
  tiktok: (
    <path
      d="M14 2v11.6a2.9 2.9 0 1 1-2.3-2.84V8.1a5.5 5.5 0 1 0 4.9 5.46V9.2a6.5 6.5 0 0 0 3.9 1.3V7.9a4 4 0 0 1-3.5-2.4A4 4 0 0 1 16.5 2H14Z"
      fill="currentColor"
    />
  ),
  facebook: (
    <path
      d="M13.5 22v-8.4h2.8l.4-3.3h-3.2V8.2c0-.95.26-1.6 1.63-1.6H16.8V3.6C16.24 3.53 15.3 3.44 14.2 3.44c-2.3 0-3.87 1.4-3.87 3.98v2.9H7.5v3.3h2.83V22h3.17Z"
      fill="currentColor"
    />
  ),
  x: (
    <path
      d="M4 3.5h4.2l4 5.6 4.6-5.6H19l-6.3 7.65L19.4 20.5h-4.2l-4.35-6.1-5.05 6.1H2.6l6.75-8.15L4 3.5Z"
      fill="currentColor"
    />
  ),
  youtube: (
    <>
      <rect x="2" y="5.5" width="20" height="13" rx="3.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M10 9.2v5.6l5-2.8-5-2.8Z" fill="currentColor" />
    </>
  ),
  whatsapp: (
    <path
      d="M12 2.5A9.5 9.5 0 0 0 3.6 16.9L2.5 21.5l4.72-1.24A9.5 9.5 0 1 0 12 2.5Zm0 1.8a7.7 7.7 0 1 1-4.1 14.22l-.3-.19-2.75.72.74-2.68-.2-.28A7.7 7.7 0 0 1 12 4.3Zm-2.72 3.9c-.2 0-.52.07-.79.37-.27.3-1.03 1-1.03 2.45s1.06 2.85 1.2 3.05c.15.2 2.06 3.16 5.1 4.3 2.53.96 2.53.64 2.98.6.46-.04 1.5-.6 1.7-1.2.2-.58.2-1.08.14-1.19-.06-.1-.22-.16-.46-.28-.24-.12-1.5-.74-1.73-.82-.23-.09-.4-.13-.57.13-.17.27-.65.82-.8 1-.14.16-.29.18-.53.06-.24-.12-1.02-.38-1.94-1.2-.72-.63-1.2-1.42-1.35-1.66-.14-.24-.02-.37.11-.5.11-.11.24-.29.37-.43.12-.15.16-.25.24-.42.08-.16.04-.31-.02-.43-.06-.12-.57-1.4-.79-1.9-.2-.5-.42-.42-.57-.43Z"
      fill="currentColor"
    />
  ),
  pinterest: (
    <path
      d="M12 2.5a9.5 9.5 0 0 0-3.46 18.34c-.05-.79-.1-2 .02-2.86.11-.78.72-3.09.72-3.09s-.18-.37-.18-.9c0-.85.49-1.48 1.1-1.48.52 0 .77.39.77.86 0 .52-.34 1.31-.51 2.03-.14.61.31 1.1.92 1.1 1.1 0 1.95-1.16 1.95-2.83 0-1.48-1.06-2.51-2.58-2.51-1.76 0-2.79 1.32-2.79 2.68 0 .53.2 1.1.46 1.41.05.06.06.11.04.18l-.17.68c-.03.11-.09.14-.21.08-.78-.36-1.26-1.5-1.26-2.42 0-1.97 1.43-3.78 4.12-3.78 2.16 0 3.84 1.54 3.84 3.6 0 2.15-1.35 3.88-3.23 3.88-.63 0-1.22-.33-1.42-.72l-.39 1.47c-.14.54-.52 1.21-.77 1.62A9.5 9.5 0 1 0 12 2.5Z"
      fill="currentColor"
    />
  ),
};

export default function SocialIcon({ network }: { network: SocialNetwork }) {
  return (
    <svg
      role="img"
      aria-label={LABELS[network]}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      style={{ display: 'block' }}
    >
      {PATHS[network]}
    </svg>
  );
}
