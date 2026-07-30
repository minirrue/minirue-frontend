'use client';

/**
 * Crop-before-upload step for a customer's account photo (owner request
 * 2026-07-30: shoppers get an avatar upload like staff already have). Locked
 * to 1:1 — this always renders in a circle, so anything else would leave the
 * edges cropped unpredictably by whatever CSS happens to display it.
 *
 * There was no existing crop UI anywhere in the storefront to reuse (unlike
 * the dashboard's ImageCropModal, which wraps `react-image-crop` — a
 * dependency this app does not have). Built with plain pointer events + a
 * `<canvas>` rather than adding one, since a square-only, always-cover crop
 * needs none of a general free-aspect cropper's machinery. Uses
 * `MobileSheet` so it arrives with the same chrome as every other sheet in
 * this app (WriteReviewSheet, SearchSheet, …).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import MobileSheet from '@/components/ui/MobileSheet';

const BOX_SIZE = 280; // CSS px — the square crop viewport
const OUTPUT_SIZE = 640; // px — plenty for a circle avatar at any real display size
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

interface Offset {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface AvatarCropSheetProps {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
}

export default function AvatarCropSheet({ open, file, onCancel, onCropped }: AvatarCropSheetProps) {
  const [src, setSrc] = useState('');
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startOffset: Offset } | null>(null);

  useEffect(() => {
    if (!file) {
      setSrc('');
      return;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setError(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // `cover`-fit scale at zoom 1 — the smallest scale where the image still
  // fills the whole square with no gap, same rule object-fit:cover uses.
  const baseScale =
    natural.width > 0 && natural.height > 0
      ? Math.max(BOX_SIZE / natural.width, BOX_SIZE / natural.height)
      : 1;
  const scale = baseScale * zoom;
  const displayWidth = natural.width * scale;
  const displayHeight = natural.height * scale;

  const clampOffset = useCallback(
    (next: Offset): Offset => ({
      // The image can pan until its edge reaches the box edge, never past —
      // an offset of 0 is flush left/top, BOX_SIZE - displayWidth is flush
      // right/bottom (a negative number, since the image is always >= the box).
      x: clamp(next.x, Math.min(0, BOX_SIZE - displayWidth), 0),
      y: clamp(next.y, Math.min(0, BOX_SIZE - displayHeight), 0),
    }),
    [displayWidth, displayHeight],
  );

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNatural({ width: img.naturalWidth, height: img.naturalHeight });
    setOffset({ x: 0, y: 0 });
  };

  // Re-clamp whenever zoom changes the image's displayed size — otherwise
  // zooming out can leave the box showing empty space past the image edge.
  useEffect(() => {
    setOffset((prev) => clampOffset(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, natural.width, natural.height]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOffset: offset };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(
      clampOffset({
        x: dragRef.current.startOffset.x + dx,
        y: dragRef.current.startOffset.y + dy,
      }),
    );
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const handleSave = async () => {
    const img = imgRef.current;
    if (!img || !natural.width || !natural.height) {
      setError('Photo is still loading — try again in a moment.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get a drawing context.');
      ctx.imageSmoothingQuality = 'high';
      const ratio = OUTPUT_SIZE / BOX_SIZE;
      ctx.drawImage(
        img,
        offset.x * ratio,
        offset.y * ratio,
        displayWidth * ratio,
        displayHeight * ratio,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92),
      );
      if (!blob) throw new Error('Cropping failed.');
      onCropped(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cropping failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileSheet
      open={open}
      onClose={onCancel}
      title="Crop your photo"
      traceId="PG-STOREFRONT-ACCOUNT::EL-SHEET-avatar-crop"
      footer={
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              flex: '0 0 auto',
              background: 'transparent',
              border: '1px solid var(--mr-border)',
              borderRadius: 'var(--mr-radius-sm)',
              padding: '10px 18px',
              fontSize: 'var(--mr-text-sm)',
              color: 'var(--mr-fg-2)',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !src}
            style={{
              flex: '1 1 auto',
              background: 'var(--mr-accent)',
              color: 'var(--mr-cream-100)',
              border: 'none',
              borderRadius: 'var(--mr-radius-sm)',
              padding: '10px 18px',
              fontFamily: 'var(--mr-font-label)',
              fontSize: 'var(--mr-text-xs)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Saving…' : 'Use this photo'}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            width: BOX_SIZE,
            height: BOX_SIZE,
            borderRadius: '50%',
            overflow: 'hidden',
            position: 'relative',
            background: 'var(--mr-bg-raised)',
            border: '1px solid var(--mr-border)',
            touchAction: 'none',
            cursor: src ? 'grab' : 'default',
          }}
        >
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={src}
              alt=""
              onLoad={onImageLoad}
              draggable={false}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: displayWidth || undefined,
                height: displayHeight || undefined,
                maxWidth: 'none',
                transform: `translate(${offset.x}px, ${offset.y}px)`,
                userSelect: 'none',
              }}
            />
          )}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: BOX_SIZE }}>
          <span style={{ fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-3)' }}>Zoom</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            style={{ flex: 1 }}
            aria-label="Zoom"
          />
        </label>

        {error && (
          <p role="alert" style={{ color: 'var(--mr-danger)', fontSize: 'var(--mr-text-sm)', margin: 0 }}>
            {error}
          </p>
        )}
      </div>
    </MobileSheet>
  );
}
