'use client';

import React from 'react';
import Sparkle from '@/components/ui/Sparkle';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let killed = false;

    async function run() {
      const { gsap } = await import('gsap');
      if (killed || !ref.current) {
        setTimeout(onComplete, 400);
        return;
      }

      const tl = gsap.timeline({
        onComplete: () => {
          if (killed) return;
          gsap.to(ref.current, {
            opacity: 0,
            duration: 0.7,
            ease: 'power2.inOut',
            onComplete,
          });
        },
      });

      tl.from('.splash-letter', {
        opacity: 0, y: 32, duration: 0.6, ease: 'power3.out', stagger: 0.045,
      })
        .from('.splash-caption', {
          opacity: 0, letterSpacing: '0.7em', duration: 0.9, ease: 'power3.out',
        }, '-=0.25')
        .from('.splash-sparkle', {
          scale: 0, rotation: -45, opacity: 0, duration: 0.5, ease: 'back.out(2.2)',
        }, '-=0.5')
        .from('.splash-line', {
          scaleX: 0, duration: 0.7, ease: 'power3.out', stagger: 0.12,
        }, '-=0.3')
        .to({}, { duration: 0.55 });
    }

    run().catch(() => setTimeout(onComplete, 400));

    return () => {
      killed = true;
    };
  // onComplete is stable (passed from parent useState setter)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'var(--mr-ink-900)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* Top hairline */}
      <div
        className="splash-line"
        style={{
          position: 'absolute',
          top: 56,
          left: '10%',
          right: '10%',
          height: 1,
          background: 'rgba(238,230,209,0.14)',
          transformOrigin: 'left center',
        }}
      />
      {/* Bottom hairline */}
      <div
        className="splash-line"
        style={{
          position: 'absolute',
          bottom: 56,
          left: '10%',
          right: '10%',
          height: 1,
          background: 'rgba(238,230,209,0.14)',
          transformOrigin: 'right center',
        }}
      />

      <div style={{ textAlign: 'center' }}>
        {/* Letter-by-letter wordmark */}
        <div
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontWeight: 500,
            fontSize: 'clamp(56px, 10vw, 96px)',
            color: 'var(--mr-gold-500)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            letterSpacing: '-0.01em',
            lineHeight: 1,
            gap: 1,
          }}
        >
          {'MiniRue'.split('').map((l, i) => (
            <span key={i} className="splash-letter" style={{ display: 'inline-block' }}>
              {l}
            </span>
          ))}
          <span
            className="splash-sparkle"
            style={{ display: 'inline-flex', marginLeft: 6, marginTop: 6 }}
          >
            <Sparkle size={32} color="var(--mr-gold-400)" />
          </span>
        </div>

        {/* Caption */}
        <div
          className="splash-caption"
          style={{
            fontFamily: 'Jost, sans-serif',
            fontWeight: 400,
            fontSize: 11,
            letterSpacing: '0.34em',
            textTransform: 'uppercase',
            color: 'var(--mr-ink-400)',
            marginTop: 14,
          }}
        >
          Cosmetics &amp; Perfumes
        </div>
      </div>
    </div>
  );
}
