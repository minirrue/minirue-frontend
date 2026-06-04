'use client';

import React from 'react';

interface SparkleProps {
  size?: number;
  color?: string;
}

export default function Sparkle({ size = 14, color = 'var(--mr-gold-500)' }: SparkleProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill={color} aria-hidden="true">
      <path d="M16 0 C16 7,17 12,22 14 C17 16,16 21,16 32 C16 21,15 16,10 14 C15 12,16 7,16 0 Z" />
    </svg>
  );
}
