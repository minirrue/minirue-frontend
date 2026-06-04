'use client';

import React from 'react';
import Button from '@/components/ui/Button';
import BottleSVG from '@/components/ui/BottleSVG';
import Sparkle from '@/components/ui/Sparkle';
import { useScrollReveal } from '@/lib/motion/hooks';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';

export default function EditorialBlock() {
  const photo = useScrollReveal({ from: { y: 28, opacity: 0, scale: 0.97 } });
  const copy = useScrollReveal({ from: { y: 18, opacity: 0, scale: 1 }, delay: 80 });
  const { mobile } = useBreakpoint();

  return (
    <section
      data-mr-surface="ink"
      style={{
        background: 'var(--mr-ink-900)',
        color: 'var(--mr-cream-100)',
        padding: 'clamp(64px,10vw,120px) var(--mr-gutter)',
        marginTop: 48,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : '1fr 1fr',
          gap: mobile ? 48 : 80,
          alignItems: 'center',
        }}
      >
        <div
          ref={photo.ref}
          style={{
            ...photo.style,
            aspectRatio: mobile ? '4/3' : '3/4',
            background: 'linear-gradient(135deg,#3B0001,#670003 50%,#1A0000)',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 'var(--mr-radius-lg)',
            boxShadow: 'var(--mr-shadow-crimson)',
          }}
        >
          <div
            className="mr-hero-drift"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transformOrigin: '50% 55%',
            }}
          >
            <BottleSVG bottle="crimson" cap="cream" />
          </div>
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              fontFamily: 'Jost, sans-serif',
              fontSize: 10,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--mr-cream-100)',
              opacity: 0.6,
            }}
          >
            Editorial · N°4
          </div>
        </div>

        <div ref={copy.ref} style={copy.style}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mr-gold-300)', marginBottom: 20 }}>
            The Journal
          </div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400, fontSize: 'clamp(32px,5vw,52px)', lineHeight: 1.08, letterSpacing: '-0.01em', margin: '0 0 28px' }}>
            A study in bitter cherry and tonka.
          </h2>
          <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 16, lineHeight: 1.65, color: 'var(--mr-cream-200)', opacity: 0.85, maxWidth: 420, margin: '0 0 36px' }}>
            It opens quietly. Almost shy. Then — after a beat — the bitterness of an old confit, the warmth of a wood drawer, the memory of someone who was here an hour ago.
          </p>
          <Button variant="outlineLight">
            Read the essay <span className="mr-link-arrow">→</span>
          </Button>
        </div>
      </div>
    </section>
  );
}
