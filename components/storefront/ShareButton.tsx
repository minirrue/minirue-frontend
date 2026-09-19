'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { SITE_URL } from '@/lib/seo/config';
import { track } from '@/lib/analytics';

interface ShareButtonProps {
  /** Absolute or root-relative URL to share. Resolved against the live origin. */
  url: string;
  title: string;
  /** Short line shown by apps that render a description (WhatsApp, Telegram…). */
  text?: string;
  traceId?: string;
  /**
   * When set, a successful share/copy fires `share_click` (dashboard#121).
   * Optional because this button is not always used on a product page.
   */
  productId?: string;
}

/**
 * Share control that works everywhere the shop is used:
 *
 * - iOS Safari / Android Chrome — the OS share sheet via navigator.share.
 * - Chrome on Windows — also implements navigator.share (opens the Windows
 *   share flyout); when the user dismisses it we stay silent rather than
 *   reporting an error.
 * - Anything without it (Firefox, older desktop browsers) — copies the link.
 *
 * The link itself is what carries the SEO: the product route already emits
 * OpenGraph/Twitter tags with the cover image, so a pasted URL unfurls with the
 * product photo, name and brand in every chat app and social preview.
 */
export default function ShareButton({ url, title, text, traceId, productId }: ShareButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const absoluteUrl = React.useMemo(() => {
    if (/^https?:\/\//i.test(url)) return url;
    if (typeof window !== 'undefined') return new URL(url, window.location.origin).toString();
    // SSR: fall back to the canonical origin so the first paint is shareable too.
    return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  }, [url]);

  const copyLink = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      if (productId) track('share_click', { productId, channel: 'copy_link' });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setFailed(true);
      setTimeout(() => setFailed(false), 2400);
    }
  }, [absoluteUrl, productId]);

  const handleShare = React.useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url: absoluteUrl });
        // The OS share sheet never reports which target the shopper picked
        // (WhatsApp vs Instagram vs "Copy" inside the sheet itself, etc.) —
        // that choice happens entirely outside the page. `web_share` is the
        // honest granularity: "used native share", not a guessed target.
        if (productId) track('share_click', { productId, channel: 'web_share' });
        return;
      } catch (err) {
        // AbortError = the user closed the sheet. That is not a failure, and
        // must not fall through to copying a link they chose not to share.
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    await copyLink();
  }, [absoluteUrl, title, text, copyLink, productId]);

  const label = copied ? 'Link copied' : failed ? 'Copy failed' : 'Share';

  return (
    <button
      type="button"
      onClick={handleShare}
      data-trace-id={traceId}
      aria-label={`Share ${title}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        // Height and inset match SkuCopyButton (ApiProductDetail.tsx) so the
        // two read as one row of controls rather than two adjacent pills of
        // different sizes.
        minHeight: 40,
        padding: '0 14px',
        borderRadius: 'var(--mr-radius-pill)',
        border: '1px solid var(--mr-hairline)',
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: 'var(--mr-font-label)',
        fontSize: 'var(--mr-text-xs)',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--mr-fg-3)',
        transition: 'color var(--mr-dur-fast), border-color var(--mr-dur-fast)',
      }}
    >
      <Icon name="share" size={13} />
      <span aria-live="polite">{label}</span>
    </button>
  );
}
