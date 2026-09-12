'use client';

import React from 'react';
import RemoteImage from '@/components/ui/RemoteImage';

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
 * remote image with the same background-retry protection, since no local
 * bytes exist to fall back to.
 *
 * Object URL lifecycle is owned entirely inside this component, keyed off
 * `localFile` itself, so a new file always gets a fresh URL and the
 * PREVIOUS one is revoked by that same effect's own cleanup — never a stale
 * closure over an earlier render (see WriteReviewSheet.tsx's history: an
 * effect registered with `[]` deps closed over the FIRST render's empty
 * attachment list forever and revoked nothing on every file after that).
 *
 * ## The local branch is a raw `<img>` and always will be
 *
 * Its `src` is a `blob:` object URL for bytes that exist only in this browser
 * tab. `/_next/image` would have to fetch that from the server, and the
 * server has never seen it. There is no version of this that goes through the
 * optimizer.
 *
 * ## The remote branch goes through the optimizer — when it is told how big
 *
 * This is the change #11 left for its own PR. The remote branch backs
 * `EditorialBlock`, `CollabShowcase`, the shop category tiles, the bundle and
 * collab grids and `SpaceView` — most of the large imagery on the storefront,
 * every one of it a full imgproxy render at `dpr:2/q:95` with no AVIF and no
 * width negotiation. `components/ui/RemoteImage.tsx` explains why routing the
 * same URL through `/_next/image` is the direction that wins (#33/#34 is the
 * record of the opposite direction costing 1.4s of LCP).
 *
 * What made it harder than the nine thumbnails in #45: none of these call
 * sites has a pixel size. They pass `width: 100%; height: 100%; objectFit:
 * cover` into a fluid box, so the optimizer needs `fill` plus a `sizes` that
 * describes that box — and `sizes` is what picks the width to fetch, so a
 * wrong one is worse than none. Every converted call site therefore carries
 * the arithmetic for its own `sizes` in a comment beside it.
 *
 * Which makes the size information the *gate*, not an optional extra:
 *
 *  - `fill` + `sizes`  → optimized, fluid box (the tiles and editorial photos)
 *  - `width` + `height` → optimized, fixed box (logos, avatars)
 *  - neither            → raw `<img>` on the original URL, exactly as before
 *
 * The third case is not an oversight. `ChatPanel`'s attachment thumbnails are
 * `maxWidth/maxHeight: 200` over an image of unknown aspect — there is no
 * honest width to declare, and declaring a dishonest one is the failure mode
 * this whole exercise is trying to avoid. They keep the markup they had.
 *
 * Whatever the branch, the never-a-broken-frame rule is unchanged: a failed
 * optimizer request falls back to the original URL on a plain `<img>`
 * (`RemoteImage`), and only if THAT fails does this component's own
 * exponential-backoff retry start — ending, after five attempts, at the same
 * tap-to-retry affordance it has always shown. The optimizer added a rung
 * below the floor; it did not move the floor.
 */

const RETRY_BASE_DELAY_MS = 600;
const RETRY_MAX_ATTEMPTS = 5;

type BaseProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'onError' | 'width' | 'height' | 'sizes'
> & {
  /** The final remote URL — what the server returns for this image on every
   *  later request. */
  src: string;
  /** Bytes already in the browser for THIS image — the File/Blob just
   *  picked or cropped, whose upload `src` is the eventual result of. Omit
   *  for an image that was not just uploaded in this session. */
  localFile?: File | Blob | null;
  /** Passed to the optimizer. Deliberate rather than inherited (#11). */
  quality?: number;
};

/** Fluid box: the layout decides the width, so `sizes` has to describe it. */
type FillProps = { fill: true; sizes: string; width?: never; height?: never };
/** Fixed box: Next builds the 1x/2x ladder from the pixel count itself. */
type FixedProps = { fill?: false; width: number; height: number; sizes?: never };
/** No size information — stays a raw `<img>`, see the note above. */
type UnsizedProps = { fill?: false; width?: never; height?: never; sizes?: never };

export type UploadPreviewImageProps = BaseProps & (FillProps | FixedProps | UnsizedProps);

export default function UploadPreviewImage(props: UploadPreviewImageProps) {
  const {
    src,
    localFile,
    alt,
    style,
    className,
    fill,
    sizes,
    width,
    height,
    quality,
    onLoad,
    ...rest
  } = props as BaseProps & {
    fill?: boolean;
    sizes?: string;
    width?: number;
    height?: number;
  };

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
  //
  // Probed on the ORIGINAL url, not the optimized one, on purpose: the thing
  // that is cold is imgproxy's render of this key, and `/_next/image` has to
  // fetch that same upstream before it can answer. Confirming the upstream is
  // warm is the fact this branch actually needs.
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

  // Showing the customer's own picture — local bytes still pending
  // confirmation of the remote copy. Always a raw tag: see the note above.
  if (localUrl && !remoteReady) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={localUrl}
        alt={alt}
        style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...style } : style}
        className={className}
        width={width}
        height={height}
        onLoad={onLoad}
        {...rest}
      />
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
          ...(fill ? { position: 'absolute' as const, inset: 0 } : null),
          ...style,
        }}
      >
        Couldn&apos;t load — tap to retry
      </span>
    );
  }

  // Sized, so the optimizer can be told what to fetch. `RemoteImage` keeps its
  // own plain-`<img>` floor under this, and only calls back here once the
  // direct URL has failed too — so `handleRemoteError` still means what it
  // always meant: the picture itself could not be shown.
  if (fill && sizes) {
    return (
      <RemoteImage
        src={remoteRenderedSrc}
        alt={alt ?? ''}
        fill
        sizes={sizes}
        quality={quality}
        className={className}
        style={style}
        onError={handleRemoteError}
        onLoad={onLoad}
      />
    );
  }

  if (typeof width === 'number' && typeof height === 'number') {
    return (
      <RemoteImage
        src={remoteRenderedSrc}
        alt={alt ?? ''}
        width={width}
        height={height}
        quality={quality}
        className={className}
        style={style}
        onError={handleRemoteError}
        onLoad={onLoad}
      />
    );
  }

  // No honest width to declare — the markup that shipped before.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={remoteRenderedSrc}
      alt={alt}
      style={style}
      className={className}
      onError={handleRemoteError}
      onLoad={onLoad}
      {...rest}
    />
  );
}
