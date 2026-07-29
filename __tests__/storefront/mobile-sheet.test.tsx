import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileSheet from '@/components/ui/MobileSheet';
import {
  SHEET_EASE,
  ITEM_TRANSITION,
  itemDelay,
  ITEM_MAX_DELAY_MS,
} from '@/lib/motion/sheet';

/**
 * The owner specified this motion precisely, so it is asserted rather than
 * eyeballed: a heavy 600ms sheet, and contents that do not start moving until
 * it is roughly half-open, each 100ms behind the one before.
 */
describe('sheet motion contract', () => {
  it('holds the sheet curve and duration', () => {
    expect(SHEET_EASE).toBe('cubic-bezier(0.7,0,0.2,1)');
    expect(ITEM_TRANSITION).toBe(
      'transform 600ms cubic-bezier(0.075,0.82,0.165,1), opacity 600ms cubic-bezier(0.19,1,0.22,1)',
    );
  });

  it('starts the stagger at 300ms and steps by 100ms', () => {
    expect(itemDelay(0)).toBe('300ms');
    expect(itemDelay(1)).toBe('400ms');
    expect(itemDelay(2)).toBe('500ms');
  });

  it('caps the stagger so a long list does not read as lag', () => {
    expect(itemDelay(20)).toBe(`${ITEM_MAX_DELAY_MS}ms`);
  });
});

describe('MobileSheet', () => {
  function renderSheet(open: boolean, onClose = jest.fn()) {
    return {
      onClose,
      ...render(
        <MobileSheet open={open} onClose={onClose} title="Reviews">
          <p>first</p>
          <p>second</p>
          <p>third</p>
        </MobileSheet>,
      ),
    };
  }

  it('staggers its children in order once open', () => {
    renderSheet(true);
    const wrappers = ['first', 'second', 'third'].map(
      (t) => screen.getByText(t).parentElement as HTMLElement,
    );

    expect(wrappers[0].style.transitionDelay).toBe('300ms');
    expect(wrappers[1].style.transitionDelay).toBe('400ms');
    expect(wrappers[2].style.transitionDelay).toBe('500ms');
    wrappers.forEach((w) => expect(w.style.opacity).toBe('1'));
  });

  it('holds its children below and invisible while closed, with no exit delay', () => {
    renderSheet(false);
    const first = screen.getByText('first').parentElement as HTMLElement;

    expect(first.style.opacity).toBe('0');
    expect(first.style.transform).toBe('translateY(20px)');
    // Leaving should not stagger — the sheet takes them with it.
    expect(first.style.transitionDelay).toBe('0ms');
  });

  it('is a labelled modal dialog', () => {
    renderSheet(true);
    expect(screen.getByRole('dialog', { name: 'Reviews' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
  });

  it('closes on Escape and on the close button', async () => {
    const { onClose } = renderSheet(true);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /close reviews/i }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
