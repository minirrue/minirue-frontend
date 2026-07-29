'use client';

import React from 'react';
import Image from 'next/image';
import type { ReviewMedia } from '@/lib/api/reviews';

/**
 * The photos and clip a customer attached, shown small and opening full size.
 *
 * A video is never autoplayed and carries `preload="metadata"` — a review list
 * can hold several, and a page that starts downloading megabytes of video the
 * moment it is scrolled past is a page that costs the shopper money.
 */
export default function ReviewMediaStrip({ media }: { media: ReviewMedia[] }) {
  const [lightbox, setLightbox] = React.useState<ReviewMedia | null>(null);
  const usable = media.filter((m) => m.url);

  if (!usable.length) return null;

  return (
    <>
      <div
        className="flex flex-wrap gap-2"
        style={{ marginTop: 12 }}
        data-trace-id="PG-STOREFRONT-CAT-005::EL-REGION-review-media"
      >
        {usable.map((m) =>
          m.kind === 'IMAGE' ? (
            <button
              key={m.id}
              type="button"
              onClick={() => setLightbox(m)}
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
              <Image
                src={m.url!}
                alt="Photo from a customer"
                fill
                sizes="64px"
                style={{ objectFit: 'cover' }}
              />
            </button>
          ) : (
            <video
              key={m.id}
              src={m.url!}
              controls
              playsInline
              preload="metadata"
              aria-label="Video from a customer"
              style={{
                width: 112,
                height: 64,
                borderRadius: 'var(--mr-radius-md)',
                border: '1px solid var(--mr-hairline)',
                background: 'var(--mr-ink-900)',
                objectFit: 'cover',
              }}
            />
          ),
        )}
      </div>

      {lightbox?.url ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Customer photo"
          onClick={() => setLightbox(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setLightbox(null);
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
            <Image
              src={lightbox.url}
              alt="Photo from a customer"
              fill
              sizes="100vw"
              style={{ objectFit: 'contain' }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
