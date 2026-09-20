'use client';

import React from 'react';

type IconName =
  | 'search' | 'user' | 'bag' | 'heart' | 'close' | 'arrowRight' | 'arrowLeft'
  | 'minus' | 'plus' | 'check' | 'gift' | 'truck' | 'menu' | 'x' | 'grid' | 'external'
  | 'share' | 'chevronRight' | 'chevronLeft' | 'chevronDown' | 'home'
  | 'collab' | 'star' | 'copy'
  // The product page's promises (#189): each one is a claim the shop can
  // prove from its own settings, so each gets its own mark rather than a
  // generic tick repeated four times.
  | 'clock' | 'cash' | 'returns' | 'package' | 'shield' | 'sparkle' | 'support' | 'lock' | 'leaf';

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
  // Two offset sheets — the universal "copy" glyph. Added for the SKU control
  // on the product page; nothing existing meant "duplicate this text" and
  // borrowing `grid` or `external` would have said something else.
  copy:       <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></>,
  gift:       <><path d="M4 5h16v4H4zM6 9v11h12V9"/></>,
  truck:      <><path d="M3 7h13l3 4v6a2 2 0 0 1-2 2H3V7z"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></>,
  menu:       <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  x:          <><path d="M5 5l14 14M19 5L5 19"/></>,
  grid:       <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
  share:      <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></>,
  external:   <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></>,
  chevronRight: <><path d="M9 5l7 7-7 7"/></>,
  chevronLeft:  <><path d="M15 5l-7 7 7 7"/></>,
  chevronDown:  <><path d="M5 9l7 7 7-7"/></>,
  home:         <><path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9.5z"/></>,
  // Two overlapping circles — the bottom nav's Collab tab (W-collab): every
  // partner MiniRue works with, in one place a shopper can tap directly.
  collab:       <><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></>,
  // Filled five-point star — the Collab grid card's rating row.
  star:         <path d="M12 3.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z" fill="currentColor" stroke="none"/>,
  // Same 24-grid, same 1.5 stroke, same round caps as everything above — the
  // promises read as one hand, not as a borrowed icon pack.
  clock:        <><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>,
  cash:         <><rect x="2.5" y="6.5" width="19" height="11" rx="1.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 10v4M18 10v4"/></>,
  returns:      <><path d="M4 11a8 8 0 1 1 2.3 5.7"/><path d="M4 6.5V11h4.5"/></>,
  package:      <><path d="M12 3.2l8 4.3v9l-8 4.3-8-4.3v-9l8-4.3z"/><path d="M4 7.5l8 4.3 8-4.3M12 11.8V20.8"/></>,
  shield:       <><path d="M12 3.2l7 2.6v5.6c0 4.2-2.8 7.4-7 9-4.2-1.6-7-4.8-7-9V5.8l7-2.6z"/><path d="M9 12l2.2 2.2L15.5 10"/></>,
  sparkle:      <><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9L12 3.5z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z"/></>,
  support:      <><path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2"/><path d="M4.5 13.5h2A1.5 1.5 0 0 1 8 15v2.5A1.5 1.5 0 0 1 6.5 19h-2zM19.5 13.5h-2A1.5 1.5 0 0 0 16 15v2.5a1.5 1.5 0 0 0 1.5 1.5h2z"/></>,
  lock:         <><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></>,
  leaf:         <><path d="M20 4c-9 0-15 3.5-15 10a5 5 0 0 0 5 5c6.5 0 10-6 10-15z"/><path d="M5.5 19.5C8 15 12 11.5 16.5 9.5"/></>,
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
      // Sets the real CSS `color` too, not just the SVG `stroke` attribute —
      // a no-op for every stroke-only glyph above, but what makes the
      // `star` glyph's `fill="currentColor"` resolve to this component's
      // `color` prop instead of whatever text color it happens to inherit
      // from its DOM parent.
      style={{ color }}
    >
      {PATHS[name] ?? null}
    </svg>
  );
}
