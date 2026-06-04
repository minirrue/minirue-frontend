'use client';

import React from 'react';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import BottleSVG from '@/components/ui/BottleSVG';

export interface Slide {
  id: number;
  type: 'photo' | 'editorial';
  eyebrow: string;
  headline: string;
  sub: string;
  tagline: string;
  bg: string;
  bottle?: string;
  cap?: string;
  tile?: string;
}

interface SlideContentProps {
  slide: Slide;
  mobile: boolean;
  isActive: boolean;
  onShop?: () => void;
}

export default function SlideContent({ slide, mobile, isActive, onShop }: SlideContentProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  const textDelay = isActive ? 200 : 0;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Background */}
      {slide.type === 'photo' ? (
        <Image
          src="/perfumes.png"
          alt="MiniRue campaign"
          fill
          priority
          className="mr-hero-drift"
          style={{ objectFit: 'cover', objectPosition: '62% 50%' }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: slide.bg }}>
          <div
            className="mr-hero-drift"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: mobile ? 'center' : 'flex-end',
              paddingRight: mobile ? 0 : '8%',
              transformOrigin: '50% 55%',
              opacity: 0.9,
            }}
          >
            <div style={{ transform: `scale(${mobile ? 1.8 : 2.6})` }}>
              <BottleSVG
                bottle={slide.bottle as Parameters<typeof BottleSVG>[0]['bottle']}
                cap={slide.cap as Parameters<typeof BottleSVG>[0]['cap']}
              />
            </div>
          </div>
        </div>
      )}

      {/* Scrims */}
      <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 240, pointerEvents: 'none', background: 'linear-gradient(to bottom,rgba(11,11,11,.55),transparent)' }} />
      <div style={{ position: 'absolute', inset: 'auto 0 0 0', height: 280, pointerEvents: 'none', background: 'linear-gradient(to bottom,transparent,rgba(11,11,11,.4) 50%,rgba(11,11,11,.65) 100%)' }} />

      {/* Copy */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: mobile ? 0 : '40%',
          bottom: mobile ? 112 : 130,
          padding: mobile ? '0 24px' : '0 60px',
          zIndex: 2,
        }}
      >
        <div
          style={{
            fontFamily: 'Jost, sans-serif',
            fontSize: 11,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: 'rgba(238,230,209,0.6)',
            marginBottom: 16,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(8px)',
            transition: `opacity 500ms cubic-bezier(0.16,1,0.3,1) ${textDelay}ms, transform 500ms cubic-bezier(0.16,1,0.3,1) ${textDelay}ms`,
          }}
        >
          {slide.eyebrow}
        </div>
        <h1
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontWeight: 400,
            fontSize: mobile ? 'clamp(40px,11vw,64px)' : 'clamp(56px,7vw,96px)',
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            margin: '0 0 8px',
            color: 'var(--mr-cream-100)',
            textShadow: '0 2px 24px rgba(0,0,0,0.35)',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: `opacity 600ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 80}ms, transform 600ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 80}ms`,
          }}
        >
          {slide.headline}
        </h1>
        <h2
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: mobile ? 'clamp(28px,8vw,44px)' : 'clamp(36px,4.5vw,60px)',
            lineHeight: 0.95,
            letterSpacing: '-0.015em',
            margin: '0 0 20px',
            color: 'var(--mr-gold-300)',
            textShadow: '0 2px 16px rgba(0,0,0,0.3)',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: `opacity 600ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 160}ms, transform 600ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 160}ms`,
          }}
        >
          {slide.sub}
        </h2>
        <p
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontStyle: 'italic',
            fontSize: mobile ? 15 : 18,
            color: 'rgba(246,242,233,0.6)',
            margin: '0 0 32px',
            maxWidth: 400,
            opacity: mounted ? 1 : 0,
            transition: `opacity 500ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 260}ms`,
          }}
        >
          {slide.tagline}
        </p>
        {isActive && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(10px)',
              transition: `opacity 500ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 360}ms, transform 500ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 360}ms`,
            }}
          >
            <Button
              variant="outlineLight"
              sweep
              sweepColor="var(--mr-cream-100)"
              sweepInk="var(--mr-ink-900)"
              onClick={onShop}
            >
              Discover the edit
            </Button>
            <Button
              variant="outlineLight"
              sweep
              sweepColor="rgba(253,251,245,.15)"
              sweepInk="var(--mr-cream-100)"
              onClick={onShop}
              style={{ borderColor: 'rgba(253,251,245,.4)' }}
            >
              Read the story
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
