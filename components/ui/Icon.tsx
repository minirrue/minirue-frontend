'use client';

import React from 'react';

type IconName =
  | 'search' | 'user' | 'bag' | 'heart' | 'close' | 'arrowRight' | 'arrowLeft'
  | 'minus' | 'plus' | 'check' | 'gift' | 'truck' | 'menu' | 'x' | 'grid' | 'external';

interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  color?: string;
}

const PATHS: Record<IconName, React.ReactNode> = {
  search:     <><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>,
  user:       <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  bag:        <><path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></>,
  heart:      <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.5l-1-.9a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/></>,
  close:      <><path d="M5 5l14 14M19 5L5 19"/></>,
  arrowRight: <><path d="M4 12h16M14 6l6 6-6 6"/></>,
  arrowLeft:  <><path d="M20 12H4M10 6l-6 6 6 6"/></>,
  minus:      <><path d="M5 12h14"/></>,
  plus:       <><path d="M12 5v14M5 12h14"/></>,
  check:      <><path d="M4 12l5 5L20 6"/></>,
  gift:       <><path d="M4 5h16v4H4zM6 9v11h12V9"/></>,
  truck:      <><path d="M3 7h13l3 4v6a2 2 0 0 1-2 2H3V7z"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></>,
  menu:       <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  x:          <><path d="M5 5l14 14M19 5L5 19"/></>,
  grid:       <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
  external:   <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></>,
};

export default function Icon({ name, size = 18, stroke = 1.5, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name] ?? null}
    </svg>
  );
}
