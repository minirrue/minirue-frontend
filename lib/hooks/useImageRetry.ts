'use client';

import React from 'react';

/**
 * Backoff-retry for a remote image, and a plain answer to "should I show the
 * fallback yet".
 *
 * Product images had no `onError` handler at all, so a single failed load
 * showed the browser's broken-image icon for the rest of the page's life —
 * even though ProductCard already has a perfectly good placeholder (the
 * product name) that it only ever used when there was no image to begin with.
 *
 * The failure this guards against is not a wrong URL. The first-ever request
 * for a freshly-uploaded image is by construction a cold miss that has to
 * cross Cloudflare, imgproxy and Garage and re-encode a full-resolution
 * master; it is uniquely slow and uniquely fragile, and it resolves on its own
 * given a moment. So: retry with backoff, show the ordinary empty state
 * meanwhile, and swap the picture in the instant a retry lands.
 *
 * `&retry=N` busts the BROWSER's cache only — the imgproxy nginx cache key in
 * production is `"$scheme$host$uri$handle_webp"`, no query string — so each
 * retry re-asks for the same cacheable object rather than fragmenting the CDN.
 *
 * The dashboard's `RetryingImage` does the same job for a plain `<img>`; this
 * exists because `next/image` owns its own element and cannot be wrapped the
 * same way.
 */

const BASE_DELAY_MS = 600;
const MAX_DELAY_MS = 20_000;
const DEFAULT_MAX_ATTEMPTS = 5;

export interface ImageRetryState {
  /** Feed this to the image's `src` — it carries the cache-busting suffix. */
  src: string | null;
  /** True while the image is not displayable. Render your placeholder. */
  failed: boolean;
  onError: () => void;
  onLoad: () => void;
}

export function useImageRetry(
  src: string | null,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
): ImageRetryState {
  const [renderedSrc, setRenderedSrc] = React.useState(src);
  const [failed, setFailed] = React.useState(false);
  const attemptsRef = React.useRef(0);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // A different image entirely resets everything.
  React.useEffect(() => {
    attemptsRef.current = 0;
    setRenderedSrc(src);
    setFailed(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [src]);

  React.useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const onError = React.useCallback(() => {
    // Show the placeholder from the FIRST failure rather than holding a broken
    // frame while the retries run. They continue underneath; `onLoad` undoes
    // this the moment one succeeds.
    setFailed(true);
    const attempt = attemptsRef.current + 1;
    attemptsRef.current = attempt;
    if (attempt >= maxAttempts || !src) return;

    const delay = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const sep = src.includes('?') ? '&' : '?';
      setRenderedSrc(`${src}${sep}retry=${attempt}`);
      // Clear `failed` at the same time, and this is load-bearing.
      //
      // The caller renders its placeholder INSTEAD of the image while
      // `failed` — with `next/image` there is no way to keep a hidden element
      // mounted the way the dashboard's RetryingImage does, because the
      // component owns its own <img>. So if `failed` stayed true, the retry
      // would set a src that nothing was left to request, and the image could
      // never come back: a retry loop that cannot possibly succeed.
      //
      // Clearing it remounts the image against the new URL. A retry that also
      // fails simply sets `failed` again, so the placeholder is what shows
      // between attempts either way.
      setFailed(false);
    }, delay);
  }, [src, maxAttempts]);

  const onLoad = React.useCallback(() => setFailed(false), []);

  return { src: renderedSrc, failed, onError, onLoad };
}
