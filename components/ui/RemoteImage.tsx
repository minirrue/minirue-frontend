'use client';

import React from 'react';
import Image from 'next/image';

/**
 * A fixed-size remote image that goes THROUGH Next's optimizer, and degrades
 * to a plain `<img>` rather than to a broken frame.
 *
 * Why the optimizer and not a direct imgproxy URL (#11, and the lesson of
 * #33/#34): every image URL this storefront renders is one FIXED imgproxy
 * render, produced server-side and signed, so the frontend cannot ask for a
 * different width. A raw `<img>` therefore gets exactly one file, at whatever
 * width and quality the backend chose — today `dpr:2` at `q:95`, encoded as
 * JPEG because nothing on that path negotiates on `Accept`. Routing the same
 * URL through `/_next/image` is what buys the two things that actually decide
 * image weight: AVIF/WebP (`next.config.ts` → `images.formats`) and a quality
 * we choose. #34 measured that difference on a real product image at 1080w:
 * 485 KB direct versus 67 KB through the optimizer. The extra hop costs about
 * one RTT; the bytes are worth multiples of it.
 *
 * That is deliberately the OPPOSITE direction from the hero
 * (`lib/images/hero-loader.ts`), and the difference is not a contradiction:
 * the hero receives a server-signed MAP of widths, so it can build a real
 * srcset without Next proxying anything. Nothing else in the app gets that
 * map, so nothing else can.
 *
 * ## The fallback is not decoration
 *
 * Next's optimizer enforces `images.remotePatterns`. The live imgproxy host
 * comes from the backend's `IMGPROXY_HOST`, a deploy variable that lives in
 * neither repository — `img.minirueshop.com` is in the allowlist and is what
 * production was observed serving (#33), but a host that drifts out of that
 * list would make `/_next/image` answer 400 for every image at once. So the
 * optimizer is treated as an enhancement: if its request fails for any reason
 * — disallowed host, upstream 404, a cold-miss timeout — this swaps to the
 * original URL on a plain `<img>`, which is exactly the markup that shipped
 * before. Only if THAT also fails does `onError` fire and the caller show its
 * own placeholder (a silhouette, a glyph, an empty tile).
 *
 * This is the same shape `ReviewMediaStrip` already used for its own
 * `next/image` tiles; it is lifted here so nine call sites do not each grow a
 * copy of the state machine.
 *
 * Fixed-size only, on purpose. Every caller is a thumbnail, an avatar or a
 * logo whose CSS box is a known pixel count, so `width`/`height` give Next
 * the 1x/2x ladder it needs and no `sizes` guesswork is involved. Anything
 * that fills a fluid box wants `fill` + `sizes` and should not use this.
 */
export interface RemoteImageProps {
  src: string;
  alt: string;
  /** Intrinsic width to request. The rendered size still comes from `style`. */
  width: number;
  /** Intrinsic height to request. */
  height: number;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Fired only once BOTH the optimized request and the direct fallback have
   * failed — i.e. the image genuinely cannot be shown, not merely that the
   * optimizer said no.
   */
  onError?: () => void;
  onLoad?: () => void;
  /**
   * Set deliberately rather than left implicit (#11's "quality set
   * deliberately"). 75 is Next's default and the only value in Next 16's
   * default `images.qualities`, so raising it needs a config change too.
   */
  quality?: number;
  'data-testid'?: string;
}

export default function RemoteImage({
  src,
  alt,
  width,
  height,
  className,
  style,
  onError,
  onLoad,
  quality = 75,
  'data-testid': testId,
}: RemoteImageProps) {
  // A different URL is a different image: re-try the optimizer for it rather
  // than inheriting the previous one's verdict.
  const [optimizerFailed, setOptimizerFailed] = React.useState(false);
  React.useEffect(() => setOptimizerFailed(false), [src]);

  if (optimizerFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        style={style}
        onError={onError}
        onLoad={onLoad}
        data-testid={testId}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      quality={quality}
      className={className}
      style={style}
      onError={() => setOptimizerFailed(true)}
      onLoad={onLoad}
      data-testid={testId}
    />
  );
}
