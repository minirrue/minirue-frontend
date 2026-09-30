import { act, render, screen } from '@testing-library/react';
import GiveawayLive from '@/components/giveaway/GiveawayLive';
import {
  formatCairoTime,
  formatCountdown,
  formatDay,
  formatEgp,
  type GiveawaySnapshot,
} from '@/lib/api/giveaway';

/** A controllable EventSource: tests push `giveaway` events by hand. */
class FakeEventSource {
  static CLOSED = 2;
  static last: FakeEventSource | null = null;
  readyState = 0;
  url: string;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  constructor(url: string) {
    this.url = url;
    FakeEventSource.last = this;
  }
  addEventListener(type: string, fn: (e: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener() {}
  close() {
    this.readyState = 2;
  }
  emit(type: string, data?: unknown) {
    for (const fn of this.listeners[type] ?? []) {
      fn({ data: JSON.stringify(data) } as MessageEvent);
    }
  }
}

const base: GiveawaySnapshot = {
  pool: 'ONLINE',
  state: 'OPEN',
  day: '2026-10-01',
  timezone: 'Africa/Cairo',
  serverTime: '2026-10-01T10:00:00.000Z',
  title: 'Online giveaway',
  prize: { title: 'Oud gift box', description: '', imageUrl: null, mediaKind: 'image' },
  terms: '',
  minSpendMinor: 100000,
  countsShipping: false,
  revealAt: '2026-10-01T19:00:00.000Z',
  entriesClosed: false,
  entrants: [
    { ref: 1, name: 'Salma G.', phoneTail: '01', qualifiedAt: '2026-10-01T08:00:00.000Z' },
    { ref: 2, name: null, phoneTail: null, qualifiedAt: '2026-10-01T09:00:00.000Z' },
  ],
  winner: null,
};

beforeEach(() => {
  (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => base })) as never;
});

describe('giveaway formatting', () => {
  it('shows times in 12-hour Cairo time', () => {
    expect(formatCairoTime('2026-10-01T19:00:00.000Z')).toBe('10:00 PM');
    expect(formatCairoTime('2026-12-01T08:05:00.000Z')).toBe('10:05 AM');
  });
  it('formats money, days and countdowns', () => {
    expect(formatEgp(100000)).toBe('1,000 EGP');
    expect(formatEgp(99950)).toBe('999.50 EGP');
    expect(formatDay('2026-10-01')).toBe('Thursday, 1 October 2026');
    expect(formatCountdown(3_723_000)).toBe('01:02:03');
    expect(formatCountdown(0)).toBeNull();
  });
});

describe('GiveawayLive', () => {
  it('face down with the masked entrants, no winner', () => {
    render(<GiveawayLive slug="online" initial={base} />);
    expect(screen.getByTestId('giveaway-card')).toHaveAttribute('data-state', 'OPEN');
    expect(screen.getAllByText('Salma G.').length).toBeGreaterThan(0);
    // A hidden entrant keeps a number but no name.
    expect(screen.getAllByText('Entrant').length).toBeGreaterThan(0);
    expect(screen.queryByText("TODAY'S WINNER")).toBeNull();
    expect(screen.getByText(/revealed at 10:00 PM/)).toBeInTheDocument();
  });

  it('turns over when the stream says the winner is revealed, with no reload', () => {
    render(<GiveawayLive slug="online" initial={base} />);
    expect(FakeEventSource.last?.url).toMatch(/\/giveaway\/online\/events$/);
    act(() => {
      FakeEventSource.last?.emit('giveaway', {
        ...base,
        state: 'REVEALED',
        serverTime: '2026-10-01T19:00:00.100Z',
        winner: { ref: 1, name: 'Salma G.', phoneTail: '01' },
      });
    });
    expect(screen.getByTestId('giveaway-card')).toHaveAttribute('data-state', 'REVEALED');
    expect(screen.getByText("TODAY'S WINNER")).toBeInTheDocument();
    expect(screen.getByText('Phone ending •• 01')).toBeInTheDocument();
  });

  it('a new entrant arrives live', () => {
    render(<GiveawayLive slug="online" initial={base} />);
    act(() => {
      FakeEventSource.last?.emit('giveaway', {
        ...base,
        entrants: [
          ...(base.entrants ?? []),
          { ref: 3, name: 'Omar G.', phoneTail: '02', qualifiedAt: '2026-10-01T10:00:00.000Z' },
        ],
      });
    });
    expect(screen.getAllByText('Omar G.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3 entrants').length).toBeGreaterThan(0);
  });

  it('switched off shows the closed page', () => {
    render(<GiveawayLive slug="booth" initial={{ ...base, state: 'OFF' }} />);
    expect(screen.getByText('No giveaway running right now')).toBeInTheDocument();
  });
});
