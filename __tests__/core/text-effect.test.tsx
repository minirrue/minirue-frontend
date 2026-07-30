import React from 'react';
import { render, screen } from '@testing-library/react';
import { TextEffect } from '@/components/core/text-effect';

/**
 * The Ebneely footer signature (Footer.tsx) is the only current consumer of
 * this component — narrow, direct coverage of the one thing it must get
 * right for that use: the full string is always present for a screen reader
 * (and for a plain-text assertion) regardless of whether it's animated, and
 * `prefers-reduced-motion` turns the animation off outright rather than just
 * speeding it up.
 */
describe('TextEffect', () => {
  it('renders the full string per-char, readable as one line of text', () => {
    render(<TextEffect per="char" preset="fade">Powered by Ebneely</TextEffect>);
    // The sr-only span carries the whole string undivided for assistive tech;
    // the per-char spans are aria-hidden duplicates for the animation.
    expect(screen.getByText('Powered by Ebneely', { selector: '.sr-only' })).toBeInTheDocument();
  });

  it('renders as plain, unsplit text under prefers-reduced-motion', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    const { container } = render(
      <TextEffect per="char" preset="fade">Powered by Ebneely</TextEffect>,
    );

    // No per-character split: the whole string sits in ONE text node, not
    // fragmented across many <span> children.
    expect(container.querySelectorAll('span').length).toBe(0);
    expect(container.textContent).toBe('Powered by Ebneely');

    window.matchMedia = original;
  });
});
