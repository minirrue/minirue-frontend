import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useIdleImport } from '@/lib/hooks/useIdleImport';

/**
 * Closed overlays load after the page does, or at once when asked for (#76).
 * What matters to a shopper is pinned here: nothing loads during the page load,
 * an overlay opened early still mounts CLOSED first (so it animates), and a
 * remount — every page builds its own Header — does not wait again.
 */

type Mod = { Panel: (p: { open: boolean }) => React.ReactElement };
const Panel = ({ open }: { open: boolean }) => <div data-testid="panel" data-open={String(open)} />;

function deferred() {
  let resolve!: (m: Mod) => void;
  const promise = new Promise<Mod>((r) => { resolve = r; });
  return { promise, resolve };
}

function Host({ load, open }: { load: () => Promise<Mod>; open: boolean }) {
  const { mod, armed } = useIdleImport(load, open);
  return mod ? <mod.Panel open={open && armed} /> : <span data-testid="not-loaded" />;
}

let readyState: DocumentReadyState = 'loading';
beforeEach(() => {
  readyState = 'loading';
  jest.spyOn(document, 'readyState', 'get').mockImplementation(() => readyState);
});
afterEach(() => jest.restoreAllMocks());

it('does not start loading while the page is still loading', async () => {
  const load = jest.fn(() => Promise.resolve({ Panel }));
  render(<Host load={load} open={false} />);
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  expect(load).not.toHaveBeenCalled();

  readyState = 'complete';
  await act(async () => { window.dispatchEvent(new Event('load')); });
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  expect(await screen.findByTestId('panel')).toHaveAttribute('data-open', 'false');
});

it('an early open loads at once, mounts closed, then opens', async () => {
  const d = deferred();
  const load = jest.fn(() => d.promise);
  render(<Host load={load} open />);
  expect(load).toHaveBeenCalledTimes(1);

  await act(async () => { d.resolve({ Panel }); await d.promise; });
  // First commit with the module: still closed, so the transition has a start.
  expect(screen.getByTestId('panel')).toHaveAttribute('data-open', 'false');
  await waitFor(() => expect(screen.getByTestId('panel')).toHaveAttribute('data-open', 'true'));
});

it('a remount after loading gets the module synchronously, already armed', async () => {
  readyState = 'complete';
  const load = jest.fn(() => Promise.resolve({ Panel }));
  const first = render(<Host load={load} open={false} />);
  await screen.findByTestId('panel');
  first.unmount();

  render(<Host load={load} open />);
  expect(screen.getByTestId('panel')).toHaveAttribute('data-open', 'true');
  expect(load).toHaveBeenCalledTimes(1);
});
