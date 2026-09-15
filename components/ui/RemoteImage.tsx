'use client';

import React from 'react';
import Image from 'next/image';

/**
 * A remote image that goes THROUGH Next's optimizer, and degrades to a plain
 * `<img>` rather than to a broken frame.
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
 * `next/image` tiles; it is lifted here so the call sites do not each grow a
 * copy of the state machine.
 *
 * ## Two modes, and `sizes` is mandatory in the fluid one
 *
 * **fixed** — `width`/`height` are a known pixel count, so Next builds the
 * 1x/2x ladder on its own and no `sizes` guesswork is involved. Every caller
 * added in #45 (thumbnails, avatars, a logo) is this shape.
 *
 * **fill** — the image stretches to a positioned parent whose size the layout
 * decides, not the image. Next then has no idea how wide to fetch: with no
 * `sizes` it assumes full viewport width, so a 146px category tile would pull
 * the 1920px rung and the change would be a regression, not a win. `sizes` is
 * the only thing that corrects that, which is why it is required by the TYPE
 * here rather than merely documented — a `fill` without `sizes` is worse than
 * the raw `<img>` it replaces, so it should not be expressible.
 *
 * Derive `sizes` from the real box width at each breakpoint and err HIGH: an
 * over-estimate wastes bytes, an under-estimate ships a visibly soft picture,
 * and only one of those is a bug a shopper can see. The per-call-site working
 * is written down at each call site.
 *
 * `fill` needs `position: relative` (or absolute/fixed) on the parent, exactly
 * as `next/image` does. The plain-`<img>` fallback reproduces the same
 * absolutely-positioned geometry, so degrading never reflows the page.
 *
 * ## The photo pipeline, and why it is this one (#153)
 *
 * **imgproxy → `/_next/image` AVIF at q=90**, with WebP for browsers without
 * AVIF. `images.qualities` is `[90]`, so this also covers every direct
 * `next/image` (gallery, cards, nav, search, cart).
 *
 * Until #153 the second encode was AVIF at q=75. Next's optimizer maps that
 * to sharp's AVIF quality 55 (`quality - 20`, effort 3), and at that setting
 * glitter lost flecks, gold gradients smeared, and a 384px photo shipped in
 * about 2 KB. The owner saw it. #153 measured three live photos (a label
 * packshot, a glitter perfume bottle, a dark lifestyle shot) at 384/828/1920
 * against the top imgproxy rung as the reference:
 *
 *  - **A, AVIF q90 (chosen).** Luma PSNR 43–47 dB, up from 30–43 for the
 *    control. Indistinguishable from the reference at 1x, side by side. About
 *    1.6–2.3x the control's bytes (a Next-sharp estimate, since Vercel's
 *    encoder differs).
 *  - **B, WebP q90.** Slightly higher PSNR, but larger than A at every width
 *    on every photo, up to 4x on dark gradients. No visible gain at 1x.
 *  - **C, imgproxy's own `srcSet` (`f:webp/q:95/dpr:1`), no second encode.**
 *    Sharpest, but the ladder's rungs are 640/1024/1600/2560/3840 at q95. A
 *    DPR-3 phone asking for 1200 gets the 1600 rung, 352 KB for the perfume
 *    against 78 KB before. It also opens a second origin. Replayed on the live
 *    perfume page (Slow 4G, 4x CPU, cold cache, twice), LCP went from
 *    4.9/4.5 s to 6.7/5.9 s. Rejected on LCP, not on looks.
 *
 * Why not let imgproxy pick AVIF by `Accept`? Cloudflare in front of it
 * ignores `Vary: Accept`, so the first client to warm an edge entry fixes
 * that URL's format for everyone (backend#77, re-checked for #153: an
 * `Accept: image/avif` request gets `image/webp`, and AVIF detection is off).
 * A negotiated AVIF would then reach clients that cannot decode it.
 * Revisit C once the backend ladder has phone-sized rungs at a lower q, or
 * once the CDN varies on `Accept`.
 */
export const PHOTO_QUALITY = 90;

interface RemoteImageCommon {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Fired only once BOTH the optimized request and the direct fallback have
   * failed — i.e. the image genuinely cannot be shown, not merely that the
   * optimizer said no.
   */
  onError?: () => void;
  /** Typed as the DOM handler, not `() => void`, so a caller forwarding its own
   *  `<img onLoad>` through (ChatPanel does) type-checks against both branches. */
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
  /**
   * Set deliberately rather than left implicit (#11's "quality set
   * deliberately"). Defaults to {@link PHOTO_QUALITY}, the only value in
   * `images.qualities`; any other number is snapped to it by Next, so passing
   * one changes nothing but a dev warning.
   */
  quality?: number;
  'data-testid'?: string;
}

export interface RemoteImageFixedProps extends RemoteImageCommon {
  fill?: false;
  /** Intrinsic width to request. The rendered size still comes from `style`. */
  width: number;
  /** Intrinsic height to request. */
  height: number;
  sizes?: never;
}

export interface RemoteImageFillProps extends RemoteImageCommon {
  fill: true;
  /** Mandatory in `fill` mode — see the note above. */
  sizes: string;
  width?: never;
  height?: never;
}

export type RemoteImageProps = RemoteImageFixedProps | RemoteImageFillProps;

/** What `next/image` itself applies for `fill`, so the fallback tag occupies
 *  exactly the box the optimized one did. */
const FILL_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
};

export default function RemoteImage(props: RemoteImageProps) {
  const {
    src,
    alt,
    className,
    style,
    onError,
    onLoad,
    quality = PHOTO_QUALITY,
    'data-testid': testId,
  } = props;
  const fill = props.fill === true;

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
        width={props.fill ? undefined : props.width}
        height={props.fill ? undefined : props.height}
        sizes={props.fill ? props.sizes : undefined}
        className={className}
        style={fill ? { ...FILL_STYLE, ...style } : style}
        onError={onError}
        onLoad={onLoad}
        data-testid={testId}
      />
    );
  }

  const sizing = props.fill
    ? { fill: true as const, sizes: props.sizes }
    : { width: props.width, height: props.height };

  return (
    <Image
      src={src}
      alt={alt}
      {...sizing}
      quality={quality}
      className={className}
      style={style}
      onError={() => setOptimizerFailed(true)}
      onLoad={onLoad}
      data-testid={testId}
    />
  );
}
