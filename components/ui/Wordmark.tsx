'use client';

import React from 'react';
import Sparkle from './Sparkle';

interface WordmarkProps {
  size?: number;
  color?: string;
  captionColor?: string;
}

export default function Wordmark({
  size = 22,
  color = 'var(--mr-gold-500)',
  captionColor = 'var(--mr-ink-700)',
}: WordmarkProps) {
  return (
    <div style={{ textAlign: 'center', lineHeight: 1 }}>
      <div
        style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontWeight: 500,
          fontSize: size,
          color,
          letterSpacing: '-0.01em',
          display: 'inline-flex',
          alignItems: 'flex-start',
          gap: 3,
        }}
      >
        MiniRue
        <span className="mr-breath" style={{ display: 'inline-flex' }}>
          <Sparkle size={size * 0.35} color={color} />
        </span>
      </div>
      <div
        style={{
          fontFamily: 'Jost, sans-serif',
          fontSize: size * 0.36,
          letterSpacing: '0.34em',
          color: captionColor,
          marginTop: 5,
          textTransform: 'uppercase',
        }}
      >
        Cosmetics &amp; Perfumes
      </div>
    </div>
  );
}
