'use client';

import React from 'react';

interface StarRatingProps {
  /** Whole stars, 1-5. Halves do not exist in this system. */
  value: number;
  size?: number;
  /** Interactive when set: the row becomes a radio group the shopper can use. */
  onChange?: (value: number) => void;
  /** Announced instead of the numbers when the row is being used to pick. */
  label?: string;
}

const GOLD = 'var(--mr-gold-500)';
const EMPTY = 'var(--mr-ink-300)';

function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? GOLD : 'none'}
      stroke={filled ? GOLD : EMPTY}
      strokeWidth="1.4"
      strokeLinejoin="round"
      style={{
        transition: 'fill var(--mr-dur-fast), stroke var(--mr-dur-fast)',
        display: 'block',
      }}
    >
      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z" />
    </svg>
  );
}

/**
 * One component, two jobs.
 *
 * Reading: five glyphs and a number for anyone not looking at them. Five
 * identical shapes announce as nothing, so the glyphs are hidden and the row
 * carries the text.
 *
 * Picking: a real radio group. Arrow keys move between stars and space selects,
 * because that is what a radio group does and a shopper using a keyboard
 * should not have to learn this particular widget.
 */
export default function StarRating({
  value,
  size = 16,
  onChange,
  label = 'Your rating',
}: StarRatingProps) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const interactive = typeof onChange === 'function';
  const shown = hovered ?? value;

  if (!interactive) {
    return (
      <span
        aria-label={`${value} out of 5`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} filled={i <= Math.round(value)} size={size} />
        ))}
      </span>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onMouseLeave={() => setHovered(null)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={i === 1 ? '1 star' : `${i} stars`}
          data-trace-id={`PG-STOREFRONT-CAT-005::EL-TOGGLE-review-star@${i}`}
          // Only the selected star is tabbable, so Tab leaves the group rather
          // than walking through five stops — the arrow keys move within it.
          tabIndex={value === i || (value === 0 && i === 1) ? 0 : -1}
          onClick={() => onChange(i)}
          onMouseEnter={() => setHovered(i)}
          onFocus={() => setHovered(i)}
          onBlur={() => setHovered(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault();
              onChange(Math.min(5, (value || 0) + 1));
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault();
              onChange(Math.max(1, (value || 1) - 1));
            }
          }}
          style={{
            // 44px of tappable area around a 16px glyph.
            display: 'grid',
            placeItems: 'center',
            width: 44,
            height: 44,
            padding: 0,
            border: 0,
            background: 'none',
            cursor: 'pointer',
            transform: shown === i ? 'scale(1.12)' : 'scale(1)',
            transition: 'transform var(--mr-dur-fast) var(--mr-ease-spring)',
          }}
        >
          <Star filled={i <= shown} size={size + 6} />
        </button>
      ))}
    </div>
  );
}
