'use client';

import React from 'react';

/**
 * Task FF (2026-07-30) — a freshly uploaded picture (starting with the
 * customer account avatar) must never show broken, even for an instant.
 *
 * Root cause, established: the URL the browser is asked to fetch right after
 * an upload is byte-identical to what the server would return on any later
 * request — nothing is wrong with the address. What is wrong is that this
 * particular request is, by construction, the FIRST-EVER request for that
 * URL: a guaranteed-cold cache miss that has to cross Cloudflare, then nginx,
 * then imgproxy, then Garage, and decode + re-encode a full-resolution master
 * before a single pixel paints. That request is uniquely slow and uniquely
 * fragile, and the storefront had no retry and no local fallback for it —
 * one transient failure showed a permanently broken image.
 *
 * The fix: the browser already has the exact bytes — the customer just
 * picked (and, for an avatar, cropped) this file. There is no reason to make
 * them wait on a network round trip to see their own picture. This component
 * renders a local object URL for those bytes immediately, and keeps showing
 * it until a background probe confirms the remote `src` actually loads (with
 * the same backoff a plain retry would use), then swaps over and frees the
 * object URL. If the remote copy never loads, the customer simply keeps
 * seeing their own picture — never a broken frame.
 *
 * When `localFile` is omitted (an existing image on first paint — a review's
 * photo grid loaded from someone else's earlier upload, say), this is a
 * plain `<img>` with the same background-retry protection, since no local
 * bytes exist to fall back to.
 *
 * Object URL lifecycle is owned entirely inside this component, keyed off
 * `localFile` itself, so a new file always gets a fresh URL and the
 * PREVIOUS one is revoked by that same effect's own cleanup — never a stale
 * closure over an earlier render (see WriteReviewSheet.tsx's history: an
 * effect registered with `[]` deps closed over the FIRST render's empty
 * attachment list forever and revoked nothing on every file after that).
 */

const RETRY_BASE_DELAY_MS = 600;
const RETRY_MAX_ATTEMPTS = 5;

export interface UploadPreviewImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> {
  /** The final remote URL — what the server returns for this image on every
   *  later request. */
  src: string;
  /** Bytes already in the browser for THIS image — the File/Blob just
   *  picked or cropped, whose upload `src` is the eventual result of. Omit
   *  for an image that was not just uploaded in this session. */
  localFile?: File | Blob | null;
}

export default function UploadPreviewImage({
  src,
  localFile,
  alt,
  style,
  className,
  ...rest
}: UploadPreviewImageProps) {
  const [localUrl, setLocalUrl] = React.useState<string | null>(null);
  const [remoteReady, setRemoteReady] = React.useState(false);
  const [remoteRenderedSrc, setRemoteRenderedSrc] = React.useState(src);
  const [remoteFailed, setRemoteFailed] = React.useState(false);
  const attemptsRef = React.useRef(0);
  const retryTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // A different remote URL entirely resets the plain-retry state.
  React.useEffect(() => {
    attemptsRef.current = 0;
    setRemoteRenderedSrc(src);
    setRemoteFailed(false);
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [src]);

  // Own the object URL end to end: a fresh URL per `localFile`, revoked when
  // replaced or on unmount.
  React.useEffect(() => {
    if (!localFile) {
      setLocalUrl(null);
      return;
    }
    const url = URL.createObjectURL(localFile);
    setLocalUrl(url);
    setRemoteReady(false);
    return () => URL.revokeObjectURL(url);
  }, [localFile]);

  // Background-probe the remote URL. Only once this succeeds do we trust
  // `src` enough to show it (and free the local object URL) — swapping the
  // visible `<img>` straight to a cold URL would show the exact broken flash
  // this component exists to avoid.
  React.useEffect(() => {
    if (!localUrl) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function attempt(n: number) {
      const probe = new window.Image();
      probe.onload = () => {
        if (!cancelled) setRemoteReady(true);
      };
      probe.onerror = () => {
        if (cancelled || n + 1 >= RETRY_MAX_ATTEMPTS) return;
        timeoutId = setTimeout(() => attempt(n + 1), RETRY_BASE_DELAY_MS * 2 ** n);
      };
      probe.src = src;
    }
    attempt(0);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [src, localUrl]);

  // Free the local URL as soon as the remote copy is confirmed.
  React.useEffect(() => {
    if (remoteReady && localUrl) {
      URL.revokeObjectURL(localUrl);
      setLocalUrl(null);
    }
  }, [remoteReady, localUrl]);

  function handleRemoteError() {
    const attempt = attemptsRef.current + 1;
    attemptsRef.current = attempt;
    if (attempt >= RETRY_MAX_ATTEMPTS) {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      setRemoteFailed(true);
      return;
    }
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
    retryTimeoutRef.current = setTimeout(() => {
      const sep = src.includes('?') ? '&' : '?';
      setRemoteRenderedSrc(`${src}${sep}retry=${attempt}`);
    }, delay);
  }

  function handleRemoteRetryTap() {
    attemptsRef.current = 0;
    setRemoteFailed(false);
    setRemoteRenderedSrc(src);
  }

  // Showing the customer's own picture — no local bytes still pending
  // confirmation of the remote copy.
  if (localUrl && !remoteReady) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={localUrl} alt={alt} style={style} className={className} {...rest} />
    );
  }

  if (remoteFailed) {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={handleRemoteRetryTap}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRemoteRetryTap();
          }
        }}
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 4,
          border: '1px dashed var(--mr-border)',
          background: 'var(--mr-bg-raised)',
          color: 'var(--mr-fg-3)',
          fontSize: 11,
          lineHeight: 1.3,
          cursor: 'pointer',
          ...style,
        }}
      >
        Couldn&apos;t load — tap to retry
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={remoteRenderedSrc}
      alt={alt}
      style={style}
      className={className}
      onError={handleRemoteError}
      {...rest}
    />
  );
}
