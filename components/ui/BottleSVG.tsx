'use client';

import React from 'react';

type BottleColor = 'amber' | 'rose' | 'ink' | 'cream' | 'crimson' | 'oud';
type CapColor = 'ink' | 'gold' | 'cream';

interface BottleSVGProps {
  bottle?: BottleColor;
  cap?: CapColor;
}

const FILLS: Record<BottleColor, string> = {
  amber:   '#B0924F',
  rose:    '#E4D7B4',
  ink:     '#1A1815',
  cream:   '#DCD3BB',
  crimson: '#3B0001',
  oud:     '#2E2A24',
};

const CAP_COLORS: Record<CapColor, string> = {
  ink:   '#1A1815',
  gold:  '#95783C',
  cream: '#EEE6D1',
};

export default function BottleSVG({ bottle = 'amber', cap = 'ink' }: BottleSVGProps) {
  return (
    <svg viewBox="0 0 80 140" style={{ height: '75%', maxWidth: '60%' }} fill="none">
      <rect x="20" y="40" width="40" height="90" fill={FILLS[bottle]} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
      <rect x="28" y="20" width="24" height="22" fill={CAP_COLORS[cap]} />
      <rect x="30" y="14" width="20" height="8" fill={CAP_COLORS[cap]} opacity="0.8" />
      <rect x="26" y="70" width="28" height="30" fill="rgba(255,255,255,0.08)" />
      <text
        x="40"
        y="92"
        textAnchor="middle"
        fill="rgba(255,255,255,0.45)"
        fontFamily="Cormorant Garamond, serif"
        fontSize="6"
        letterSpacing="1"
      >
        MINI RUE
      </text>
    </svg>
  );
}
