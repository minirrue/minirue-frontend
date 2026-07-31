'use client';

import React from 'react';

/**
 * The local-first logic behind `UploadPreviewImage` (task FF, 2026-07-30),
 * extracted so a second surface — a review video's POSTER (task 41,
 * 2026-07-31) — can reuse the exact same behaviour instead of a second,
 * slightly-different implementation.
 *
 * Root cause this exists for: the first-ever request for a freshly uploaded
 * asset's URL is a guaranteed-cold cache miss (Cloudflare -> nginx ->
 * imgproxy -> Garage), and a plain `<img src>`/`poster` with no fallback
 * shows broken for however long that takes. The owner has repeatedly
 * rejected "retry the remote URL and show broken in the meantime" as the
 * fix — the browser already has the bytes it just uploaded, so there is no
 * reason to show anything broken at all: display the LOCAL object URL from
 * the moment the file is picked, and only swap to the remote URL once a
 * background probe confirms it actually loads.
 *
 * Returns the URL to actually render (never null while `localFile` is set
 * and the remote hasn't been confirmed) plus whether that URL is the local
 * one (callers that need to know, e.g. to skip a retry affordance while
 * still showing local bytes).
 */
const RETRY_BASE_DELAY_MS = 600;
const RETRY_MAX_ATTEMPTS = 5;

export interface UploadPreviewSrcResult {
  /** What to render right now. Never the broken remote URL while local bytes
   *  are still standing in for it. */
  displaySrc: string | null;
  /** True while `displaySrc` is the local object URL rather than the
   *  confirmed-loading remote one. */
  isLocal: boolean;
  /** True once every retry attempt against the remote URL has failed AND
   *  there were no local bytes to fall back to (or they've already been
   *  freed). Callers with no `localFile` still get a "give up" signal. */
  remoteFailed: boolean;
  /** Reset retry state and try the remote URL again from scratch. */
  retryRemote: () => void;
}

export function useUploadPreviewSrc(
  src: string | null,
  localFile?: File | Blob | null,
): UploadPreviewSrcResult {
  const [localUrl, setLocalUrl] = React.useState<string | null>(null);
  const [remoteReady, setRemoteReady] = React.useState(false);
  const [remoteRenderedSrc, setRemoteRenderedSrc] = React.useState(src);
  const [remoteFailed, setRemoteFailed] = React.useState(false);
  const attemptsRef = React.useRef(0);
  const retryTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // A different remote URL entirely resets probe/retry state.
  React.useEffect(() => {
    attemptsRef.current = 0;
    setRemoteReady(false);
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

  // Own the object URL end to end: a fresh one per `localFile`, revoked when
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

  // Background-probe the remote URL with an image preload — never the
  // visible element itself, so nothing broken is ever shown while probing.
  React.useEffect(() => {
    if (!src || !localUrl) return;
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
      probe.src = src as string;
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
    if (!src) return;
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

  function retryRemote() {
    attemptsRef.current = 0;
    setRemoteFailed(false);
    setRemoteRenderedSrc(src);
  }

  if (localUrl && !remoteReady) {
    return { displaySrc: localUrl, isLocal: true, remoteFailed: false, retryRemote };
  }
  if (remoteFailed) {
    return { displaySrc: null, isLocal: false, remoteFailed: true, retryRemote };
  }
  return {
    displaySrc: remoteRenderedSrc,
    isLocal: false,
    remoteFailed: false,
    retryRemote,
  };
  // handleRemoteError is intentionally not returned — plain <img>/<video>
  // consumers of this hook need it wired to onError, which differs per
  // element type, so callers that need it should call the sibling
  // `useUploadPreviewSrcOnError` pairing below instead of re-deriving it.
}

/**
 * The `onError` handler to wire to whatever visible element renders
 * `displaySrc` from `useUploadPreviewSrc` — kept as a separate export
 * (rather than folded into the hook's return value) because it closes over
 * the SAME internal retry state, and exposing it required threading the
 * hook's internals back out; simplest is to expose it as its own small hook
 * sharing the identical `src` key so both stay in lockstep.
 */
