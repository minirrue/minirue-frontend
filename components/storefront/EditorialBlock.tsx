'use client';

import React from 'react';
import Button from '@/components/ui/Button';
import BottleSVG from '@/components/ui/BottleSVG';
import { useScrollReveal } from '@/lib/motion/hooks';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import type { ResolvedSection } from '@/lib/api/storefront';

type JournalSection = Extract<ResolvedSection, { type: 'journal' }>;

export default function EditorialBlock({ section }: { section: JournalSection }) {
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
            order: section.imageSide === 'right' ? 2 : 1,
            aspectRatio: mobile ? '4/3' : '3/4',
            background: 'linear-gradient(135deg,#3B0001,#670003 50%,#1A0000)',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 'var(--mr-radius-lg)',
            boxShadow: 'var(--mr-shadow-crimson)',
          }}
        >
          {section.imageUrl ? (
            <img
              src={section.imageUrl}
              alt=""
              className="mr-hero-drift"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              className="mr-hero-drift"
              style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center', transformOrigin: '50% 55%',
              }}
            >
              <BottleSVG bottle="crimson" cap="cream" />
            </div>
          )}
          {section.badge && (
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
              {section.badge}
            </div>
          )}
        </div>

        <div ref={copy.ref} style={{ ...copy.style, order: section.imageSide === 'right' ? 1 : 2 }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mr-gold-300)', marginBottom: 20 }}>
            {section.eyebrow}
          </div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400, fontSize: 'clamp(32px,5vw,52px)', lineHeight: 1.08, letterSpacing: '-0.01em', margin: '0 0 28px' }}>
            {section.title}
          </h2>
          <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 16, lineHeight: 1.65, color: 'var(--mr-cream-200)', opacity: 0.85, maxWidth: 420, margin: '0 0 36px' }}>
            {section.body}
          </p>
          {section.ctaLabel &&
            (section.ctaHref ? (
              <a href={section.ctaHref} className="mr-hero-cta">
                {section.ctaLabel} <span className="mr-link-arrow">→</span>
              </a>
            ) : (
              <Button variant="outlineLight">
                {section.ctaLabel} <span className="mr-link-arrow">→</span>
              </Button>
            ))}
        </div>
      </div>
    </section>
  );
}
