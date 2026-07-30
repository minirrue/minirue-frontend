'use client';

/**
 * MobileSheet — a bottom sheet that rises, with its contents arriving behind it.
 *
 * The motion contract lives in lib/motion/sheet.ts and is the same one
 * MobileNavSheet and SearchSheet already ship, so a sheet opened from the
 * product page feels like a sheet opened from the header.
 *
 * What this adds over rolling it by hand each time:
 *   - drag-to-dismiss via useSheetDrag, with the backdrop fading under the
 *     finger rather than after it
 *   - Escape to close, and focus that goes into the sheet on open and returns
 *     to whatever opened it on close
 *   - the page behind is locked, so scrolling to the end of the sheet does not
 *     start scrolling the page underneath
 *   - the 60px top inset, so the sheet never covers the status bar
 *   - children staggered in, in order, without the caller counting delays
 *
 * Children are staggered as direct elements. Pass a fragment's worth of
 * siblings, not one wrapper div, or the whole thing arrives as a single block.
 */

import React from 'react';
import IconButton from '@/components/ui/IconButton';
import { useSheetDrag } from '@/lib/hooks/useSheetDrag';
import { SHEET_EASE, SHEET_DURATION_MS, itemStyle } from '@/lib/motion/sheet';

interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  /** Named for screen readers, and shown in the header strip. */
  title: string;
  children: React.ReactNode;
  /** Pinned to the bottom, outside the scroll area — a submit button belongs here. */
  footer?: React.ReactNode;
  traceId?: string;
}

export default function MobileSheet({
  open,
  onClose,
  title,
  children,
  footer,
  traceId,
}: MobileSheetProps) {
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const openerRef = React.useRef<HTMLElement | null>(null);

  const drag = useSheetDrag({
    direction: 'down',
    enabled: open,
    onDismiss: onClose,
    sheetRef,
  });

  // Escape closes.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock the page behind the sheet, otherwise scrolling inside it chains to the
  // body once it hits its end and the page slides away under the shopper.
  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Focus moves into the sheet on open and back to the trigger on close —
  // otherwise a keyboard user is left tabbing through the page behind a sheet
  // they cannot see the focus ring in.
  React.useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement as HTMLElement | null;
      const t = setTimeout(() => sheetRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    openerRef.current?.focus?.();
  }, [open]);

  // Keep tab focus inside while it is open.
  const onKeyDownTrap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !sheetRef.current) return;
    const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(11,11,11,0.5)',
          // `none`, not `blur(0)`, when closed. A backdrop-filter of any value
          // — zero included — promotes this to its own compositing layer that
          // keeps sampling everything behind it. This wrapper is z-index 60,
          // above the site header at 50, so that layer sat over the top bar on
          // every page whether or not a sheet was open.
          backdropFilter: open ? 'blur(4px)' : 'none',
          WebkitBackdropFilter: open ? 'blur(4px)' : 'none',
          // Belt and braces with the opacity: a closed backdrop is not merely
          // transparent, it is absent.
          visibility: open ? 'visible' : 'hidden',
          opacity: open ? 1 - drag.progress : 0,
          transition: drag.dragging
            ? 'none'
            : 'opacity 400ms var(--mr-ease-snappy), backdrop-filter 400ms ease',
        }}
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={onKeyDownTrap}
        data-trace-id={traceId}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          // Never over the status bar, and never taller than the viewport.
          maxHeight: 'calc(100dvh - 60px)',
          background: 'var(--mr-cream-100)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -18px 48px rgba(11,11,11,0.24)',
          transform: open
            ? `translateY(${Math.max(drag.offset, 0)}px)`
            : 'translateY(100%)',
          // A closed sheet is HIDDEN, not merely pushed below the fold.
          //
          // translateY(100%) parks it just under the bottom of this wrapper,
          // and the wrapper is `position: fixed; inset: 0` — which on a mobile
          // browser is the SMALL viewport, measured with the URL bar showing.
          // The moment any scroll collapses that bar the visual viewport grows
          // taller than the fixed wrapper, the wrapper's bottom edge is no
          // longer the bottom of the screen, and the sheet parked just beneath
          // it slides into view as a blank rounded panel above the home
          // indicator. That is why the tiniest scroll — the owner measured it
          // at 0.000001 — was enough to reveal it on the home and space pages,
          // where no sheet is open at all.
          //
          // `visibility` is delayed by the slide duration when closing, so the
          // sheet is still painted while it animates out and only then stops
          // existing visually. Opening flips it back with no delay.
          visibility: open ? 'visible' : 'hidden',
          // No transition mid-drag: the sheet has to track the finger exactly.
          // It comes back for the release, which is what makes the snap-back and
          // the slide-out feel like the same object.
          transition: drag.dragging
            ? 'none'
            : `transform ${SHEET_DURATION_MS}ms ${SHEET_EASE}, visibility 0s linear ${open ? 0 : SHEET_DURATION_MS}ms`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          outline: 'none',
        }}
      >
        {/* The whole header strip is the drag handle, not just the pill — a
            4px target is a decoration, and the thumb aims at the top edge. */}
        <div
          {...drag.handleProps}
          style={{
            position: 'relative',
            flex: '0 0 auto',
            padding: '18px 20px 12px',
            ...drag.handleProps.style,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 48,
              height: 4,
              borderRadius: 2,
              background: 'var(--mr-cream-400)',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 6,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--mr-font-serif)',
                fontWeight: 400,
                fontSize: 'var(--mr-text-lg)',
                color: 'var(--mr-fg)',
              }}
            >
              {title}
            </h2>
            <IconButton icon="close" size={36} tone="cream" label={`Close ${title}`} onClick={onClose} />
          </div>
        </div>

        <div
          style={{
            flex: '1 1 auto',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            padding: '4px 20px 20px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {items.map((child, i) => (
            <div key={i} style={itemStyle(i, open)}>
              {child}
            </div>
          ))}
        </div>

        {footer && (
          <div
            style={{
              flex: '0 0 auto',
              padding: '12px 20px calc(16px + env(safe-area-inset-bottom))',
              borderTop: '1px solid var(--mr-hairline)',
              background: 'var(--mr-cream-100)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
