/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { useMobileChrome } from '@/lib/hooks/useMobileChrome';

/**
 * `getServerSnapshot` must return the SAME object every call (frontend#136).
 *
 * React reads it on the client while hydrating and compares two calls; a fresh
 * `{ menuOpen: false, searchOpen: false }` each time logged "The result of
 * getServerSnapshot should be cached to avoid an infinite loop" on every page
 * (the header reads this hook).
 */
function Probe() {
  const chrome = useMobileChrome();
  return <span>{String(chrome.menuOpen)}</span>;
}

describe('useMobileChrome server snapshot', () => {
  it('hydrates without the uncached-snapshot warning', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<Probe />);
    document.body.appendChild(container);

    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await act(async () => {
        hydrateRoot(container, <Probe />);
      });
      expect(container.textContent).toBe('false');
      const messages = errors.mock.calls.map((args) => args.map(String).join(' '));
      expect(messages.filter((m) => /getServerSnapshot should be cached/.test(m))).toEqual([]);
    } finally {
      errors.mockRestore();
      container.remove();
    }
  });
});
