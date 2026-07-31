'use client';

import React from 'react';
import Image from 'next/image';
import type { ReviewMedia } from '@/lib/api/reviews';
import { useObjectUrl } from '@/lib/hooks/useObjectUrl';
import { useUploadPreviewSrc } from '@/lib/hooks/useUploadPreviewSrc';

/** Local bytes for one media row, still in THIS browser because it was just
 *  uploaded this session (see WriteReviewSheet.tsx's "done" screen) — keyed
 *  by media id so the right attachment gets the right local fallback. Omit
 *  entirely for the normal case (a review loaded from someone else's earlier
 *  upload, or on a later visit), where no local bytes exist at all. */
export interface LocalReviewMedia {
  file?: File | Blob | null;
  /** A VIDEO's poster frame, captured client-side (capturePosterFrame). */
  posterFile?: File | Blob | null;
}

/**
 * The photos and clip a customer attached, shown small and opening full size.
 *
 * A video is never autoplayed and carries `preload="metadata"` — a review list
 * can hold several, and a page that starts downloading megabytes of video the
 * moment it is scrolled past is a page that costs the shopper money.
 *
 * Task 10 (2026-07-30): the first-ever request for a freshly uploaded photo's
 * URL is a guaranteed cold miss through Cloudflare -> nginx -> imgproxy ->
 * Garage, and that request had no `onError` anywhere and no retry. A photo
 * whose upstream fetch happened to fail once was frozen broken until a manual
 * reload. Every media item below now either loads, or visibly says it
 * couldn't and offers a retry — never silently disappears.
 */
export default function ReviewMediaStrip({
  media,
  localMediaById,
}: {
  media: ReviewMedia[];
  /** Local bytes for whichever of these rows were just uploaded THIS
   *  session — see LocalReviewMedia. Omit entirely for the normal case. */
  localMediaById?: Record<string, LocalReviewMedia>;
}) {
  const [lightbox, setLightbox] = React.useState<ReviewMedia | null>(null);

  if (!media.length) return null;

  return (
    <>
      <div
        className="flex flex-wrap gap-2"
        style={{ marginTop: 12 }}
        data-trace-id="PG-STOREFRONT-CAT-005::EL-REGION-review-media"
      >
        {media.map((m) => {
          const local = localMediaById?.[m.id];
          // A media row whose upload never resolved a URL is still a media row
          // the customer attached — dropping it silently reads as "nothing was
          // attached" when something was. Show that it's broken instead —
          // UNLESS local bytes are standing in for it (just uploaded, remote
          // not resolved/warm yet), in which case there is nothing broken
          // about it at all.
          if (!m.url && !local?.file) {
            return <BrokenMediaTile key={m.id} kind={m.kind} />;
          }
          return m.kind === 'IMAGE' ? (
            <ReviewImageThumb
              key={m.id}
              media={m}
              localFile={local?.file}
              onOpen={() => setLightbox(m)}
            />
          ) : (
            <ReviewVideoThumb
              key={m.id}
              media={m}
              localFile={local?.file}
              localPosterFile={local?.posterFile}
            />
          );
        })}
      </div>

      {lightbox?.url ? (
        <LightboxImage media={lightbox} onClose={() => setLightbox(null)} />
      ) : null}
    </>
  );
}

const BASE_RETRY_DELAY_MS = 600;
const MAX_ATTEMPTS = 3;

function withRetryParam(src: string, attempt: number): string {
  const sep = src.includes('?') ? '&' : '?';
  return `${src}${sep}retry=${attempt}`;
}

/** A small placeholder for media that is missing or that gave up retrying —
 *  visible, not vanished, with a way back in when the transient failure was
 *  the only thing wrong. */
function BrokenMediaTile({
  kind,
  onRetry,
}: {
  kind: ReviewMedia['kind'];
  onRetry?: () => void;
}) {
  const width = kind === 'IMAGE' ? 64 : 112;
  const Tag = onRetry ? 'button' : 'div';
  return (
    <Tag
      type={onRetry ? 'button' : undefined}
      onClick={onRetry}
      aria-label={
        kind === 'IMAGE' ? "Customer photo couldn't load" : "Customer video couldn't load"
      }
      style={{
        width,
        height: 64,
        borderRadius: 'var(--mr-radius-md)',
        border: '1px dashed var(--mr-hairline)',
        background: 'var(--mr-cream-300)',
        display: 'grid',
        placeItems: 'center',
        padding: 4,
        fontFamily: 'var(--mr-font-ui)',
        fontSize: 10,
        lineHeight: 1.3,
        textAlign: 'center',
        color: 'var(--mr-fg-3)',
        cursor: onRetry ? 'pointer' : 'default',
      }}
    >
      {onRetry ? "Couldn't load — tap to retry" : "Couldn't load"}
    </Tag>
  );
}

/**
 * A photo thumbnail. Starts as `next/image` (the normal, optimised path); on
 * `error` it falls back to a plain `<img>` that retries the byte-identical
 * URL itself with a `600ms x 2^attempt` backoff and a cache-busting
 * `&retry=N` suffix — the imgproxy nginx cache key in production has no query
 * string, so this busts the browser's cache without fragmenting the CDN's.
 * After `MAX_ATTEMPTS` failures it shows a retry affordance instead of
 * looping forever.
 */
function ReviewImageThumb({
  media,
  localFile,
  onOpen,
}: {
  media: ReviewMedia;
  /** Present only for a photo just uploaded THIS session — see
   *  LocalReviewMedia. Renders local-first (never a broken frame while the
   *  cold remote URL warms) instead of the plain next/image+retry path
   *  below, which is for the normal "loaded from someone else's earlier
   *  upload" case with no local bytes to fall back to. */
  localFile?: File | Blob | null;
  onOpen: () => void;
}) {
  const src = media.url!;
  const localFirst = useUploadPreviewSrc(media.url, localFile);
  const [useFallback, setUseFallback] = React.useState(false);
  const [renderedSrc, setRenderedSrc] = React.useState(src);
  const [failed, setFailed] = React.useState(false);
  const attemptsRef = React.useRef(0);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  function scheduleRetry(nextAttempt: number) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const delay = BASE_RETRY_DELAY_MS * 2 ** (nextAttempt - 1);
    timeoutRef.current = setTimeout(() => {
      setRenderedSrc(withRetryParam(src, nextAttempt));
    }, delay);
  }

  function handleFallbackError() {
    const nextAttempt = attemptsRef.current + 1;
    attemptsRef.current = nextAttempt;
    if (nextAttempt >= MAX_ATTEMPTS) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setFailed(true);
      return;
    }
    scheduleRetry(nextAttempt);
  }

  function handleRetryTap() {
    attemptsRef.current = 0;
    setFailed(false);
    setRenderedSrc(src);
    setUseFallback(true);
  }

  // Local-first (task 41, 2026-07-31): this photo was just uploaded THIS
  // session, so its bytes are already in the browser — show them
  // immediately rather than making the customer wait on the guaranteed-cold
  // first request for the remote URL. `useUploadPreviewSrc` swaps to the
  // remote copy on its own once a background probe confirms it loads; a
  // broken frame is never possible in the meantime.
  if (localFile) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open this customer photo full size"
        className="relative overflow-hidden"
        style={{
          width: 64,
          height: 64,
          borderRadius: 'var(--mr-radius-md)',
          border: '1px solid var(--mr-hairline)',
          padding: 0,
          background: 'var(--mr-cream-300)',
          cursor: 'zoom-in',
        }}
      >
        {localFirst.displaySrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={localFirst.displaySrc}
            alt="Photo from a customer"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <BrokenMediaTile kind="IMAGE" onRetry={localFirst.retryRemote} />
        )}
      </button>
    );
  }

  if (failed) {
    return <BrokenMediaTile kind="IMAGE" onRetry={handleRetryTap} />;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open this customer photo full size"
      className="relative overflow-hidden"
      style={{
        width: 64,
        height: 64,
        borderRadius: 'var(--mr-radius-md)',
        border: '1px solid var(--mr-hairline)',
        padding: 0,
        background: 'var(--mr-cream-300)',
        cursor: 'zoom-in',
      }}
    >
      {useFallback ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={renderedSrc}
          alt="Photo from a customer"
          onError={handleFallbackError}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <Image
          src={src}
          alt="Photo from a customer"
          fill
          sizes="64px"
          style={{ objectFit: 'cover' }}
          onError={() => setUseFallback(true)}
        />
      )}
    </button>
  );
}

/**
 * A video clip thumbnail. On `error` it shows the same "couldn't load, tap
 * to retry" affordance as a photo — tapping remounts the element (via a
 * fresh `key`), which re-asks the browser for the same URL rather than
 * leaving a permanently broken player in the review.
 *
 * Local-first (task 41, 2026-07-31), same rule as a photo: `localFile` /
 * `localPosterFile` are only ever set for a video just uploaded THIS
 * session (see WriteReviewSheet's "done" screen). When present, the video
 * plays straight off its own local object URL (bytes already confirmed
 * good — no cold remote request needed for it at all) and the poster is
 * shown local-first via `useUploadPreviewSrc`, swapping to the resolved
 * remote poster only once a background probe confirms it loads. Without
 * them (the normal case — an approved review loaded on any later visit),
 * this still runs the same poster probe against `media.posterUrl` alone:
 * strictly better than a bare `poster` attribute, which would otherwise
 * ask the browser to paint a cold imgproxy URL with no fallback at all.
 */
function ReviewVideoThumb({
  media,
  localFile,
  localPosterFile,
}: {
  media: ReviewMedia;
  localFile?: File | Blob | null;
  localPosterFile?: File | Blob | null;
}) {
  const [failed, setFailed] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  const localVideoUrl = useObjectUrl(localFile);
  const poster = useUploadPreviewSrc(media.posterUrl, localPosterFile);

  if (failed) {
    return (
      <BrokenMediaTile
        kind="VIDEO"
        onRetry={() => {
          setFailed(false);
          setReloadKey((k) => k + 1);
        }}
      />
    );
  }

  return (
    <video
      key={reloadKey}
      // Known-good local bytes beat a remote request every time — there is
      // nothing to probe or fall back from when the browser already has the
      // exact file it just uploaded.
      src={localVideoUrl ?? media.url!}
      poster={poster.displaySrc ?? undefined}
      controls
      playsInline
      preload="metadata"
      aria-label="Video from a customer"
      onError={() => setFailed(true)}
      style={{
        width: 112,
        height: 64,
        borderRadius: 'var(--mr-radius-md)',
        border: '1px solid var(--mr-hairline)',
        background: 'var(--mr-ink-900)',
        objectFit: 'cover',
      }}
    />
  );
}

/** The full-size photo overlay. Same fallback idea as the thumbnail — a
 *  cold-cache failure here shows a retry affordance instead of an empty
 *  black frame. */
function LightboxImage({ media, onClose }: { media: ReviewMedia; onClose: () => void }) {
  const src = media.url!;
  const [useFallback, setUseFallback] = React.useState(false);
  const [renderedSrc, setRenderedSrc] = React.useState(src);
  const [failed, setFailed] = React.useState(false);
  const attemptsRef = React.useRef(0);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  function handleFallbackError() {
    const nextAttempt = attemptsRef.current + 1;
    attemptsRef.current = nextAttempt;
    if (nextAttempt >= MAX_ATTEMPTS) {
      setFailed(true);
      return;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const delay = BASE_RETRY_DELAY_MS * 2 ** (nextAttempt - 1);
    timeoutRef.current = setTimeout(() => {
      setRenderedSrc(withRetryParam(src, nextAttempt));
    }, delay);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Customer photo"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      tabIndex={-1}
      ref={(el) => el?.focus()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'rgba(11,11,11,0.86)',
        display: 'grid',
        placeItems: 'center',
        padding: 'clamp(16px, 5vw, 48px)',
        cursor: 'zoom-out',
        outline: 'none',
      }}
    >
      <div style={{ position: 'relative', width: '100%', maxWidth: 900, aspectRatio: '3/4' }}>
        {failed ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--mr-cream-100)',
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-sm)',
              textAlign: 'center',
            }}
          >
            Couldn&apos;t load this photo.
          </div>
        ) : useFallback ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={renderedSrc}
            alt="Photo from a customer"
            onError={handleFallbackError}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <Image
            src={src}
            alt="Photo from a customer"
            fill
            sizes="100vw"
            style={{ objectFit: 'contain' }}
            onError={() => setUseFallback(true)}
          />
        )}
      </div>
    </div>
  );
}
