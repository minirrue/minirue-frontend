import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, screen, within } from '@testing-library/react';
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

const LONG_NAME = 'Salma Abdelrahman El-Sayed Mostafa';

/** The 0.140.0 public payload: no prize before the reveal, latest first. */
const base: GiveawaySnapshot = {
  pool: 'ONLINE',
  state: 'OPEN',
  day: '2026-10-01',
  timezone: 'Africa/Cairo',
  serverTime: '2026-10-01T10:00:00.000Z',
  entrantCount: 3,
  title: 'Online giveaway',
  terms: '',
  minSpendMinor: 100000,
  countsShipping: false,
  revealAt: '2026-10-01T19:00:00.000Z',
  entriesClosed: false,
  entrants: [
    { ref: 3, name: 'Omar Hassan', phoneTail: '02', qualifiedAt: '2026-10-01T09:30:00.000Z' },
    { ref: 2, name: null, phoneTail: null, qualifiedAt: '2026-10-01T09:00:00.000Z' },
    { ref: 1, name: LONG_NAME, phoneTail: '01', qualifiedAt: '2026-10-01T08:00:00.000Z' },
  ],
  winner: null,
};

const prize = {
  title: 'Oud gift box',
  description: 'Three oud oils in a lacquered case.',
  imageUrl: 'https://img.example/prize.webp',
  mediaKind: 'image' as const,
};

const revealed: GiveawaySnapshot = {
  ...base,
  state: 'REVEALED',
  serverTime: '2026-10-01T19:00:00.100Z',
  entriesClosed: true,
  prize,
  winner: { ref: 1, name: LONG_NAME, phoneTail: '01' },
};

/** The single list narrow screens use; every row, top to bottom. */
function mergedRows(): string[] {
  const lists = screen.getAllByRole('region', { name: 'Entrants' });
  const merged = lists[lists.length - 1];
  return within(merged)
    .getAllByRole('listitem')
    .map((li) => li.textContent ?? '');
}

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
  it('face down with the entrants, no winner and nothing about the prize', () => {
    render(<GiveawayLive slug="online" initial={base} />);
    expect(screen.getByTestId('giveaway-card')).toHaveAttribute('data-state', 'OPEN');
    // A hidden entrant keeps a number but no name.
    expect(screen.getAllByText('Entrant').length).toBeGreaterThan(0);
    expect(screen.queryByText("TODAY'S WINNER")).toBeNull();
    expect(screen.getByText(/revealed at 10:00 PM/)).toBeInTheDocument();
    expect(screen.queryByTestId('giveaway-prize')).toBeNull();
    expect(screen.queryByText(/prize/i)).toBeNull();
  });

  it('never shows a prize before the reveal, even if an older backend sent one', () => {
    render(<GiveawayLive slug="online" initial={{ ...base, prize }} />);
    expect(screen.queryByTestId('giveaway-prize')).toBeNull();
    expect(screen.queryByText('Oud gift box')).toBeNull();
    expect(screen.queryByText(/Today's prize/)).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('lists full names, whole', () => {
    render(<GiveawayLive slug="online" initial={base} />);
    expect(screen.getAllByText(LONG_NAME).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Omar Hassan').length).toBeGreaterThan(0);
  });

  it('never cuts a name short in the stylesheet', () => {
    const css = readFileSync(
      join(process.cwd(), 'components/giveaway/giveaway.module.css'),
      'utf8',
    );
    for (const cls of ['name', 'winnerName']) {
      const rule = css.match(new RegExp(`\\.${cls} \\{([^}]*)\\}`))?.[1];
      expect(rule).toBeDefined();
      expect(rule).not.toMatch(/text-overflow|white-space:\s*nowrap|overflow:\s*hidden|line-clamp/);
    }
  });

  it('puts the latest entrant first', () => {
    render(<GiveawayLive slug="online" initial={base} />);
    const rows = mergedRows();
    expect(rows[0]).toContain('Omar Hassan');
    expect(rows[2]).toContain(LONG_NAME);
  });

  it('puts the latest first even when an older payload lists them first-come', () => {
    const oldOrder = { ...base, entrants: [...(base.entrants ?? [])].reverse() };
    render(<GiveawayLive slug="online" initial={oldOrder} />);
    expect(mergedRows()[0]).toContain('Omar Hassan');
  });

  it('on wide screens reads down the latest half, then the earlier half', () => {
    render(<GiveawayLive slug="online" initial={base} />);
    const [left] = screen.getAllByRole('region', { name: 'Entrants' });
    const leftRows = within(left).getAllByRole('listitem').map((li) => li.textContent);
    expect(leftRows).toHaveLength(2);
    expect(leftRows[0]).toContain('Omar Hassan');
    const earlier = screen.getByRole('region', { name: 'Earlier' });
    expect(within(earlier).getByText(LONG_NAME)).toBeInTheDocument();
  });

  it('shows how many have entered', () => {
    render(<GiveawayLive slug="online" initial={base} />);
    expect(screen.getByTestId('giveaway-count')).toHaveTextContent('3 entrants so far');
  });

  it('counts the list when an older payload has no entrantCount', () => {
    const older = { ...base, entrantCount: undefined, entrants: base.entrants?.slice(0, 1) };
    render(<GiveawayLive slug="online" initial={older} />);
    expect(screen.getByTestId('giveaway-count')).toHaveTextContent('1 entrant so far');
  });

  it('shows no amount against anyone', () => {
    render(<GiveawayLive slug="online" initial={base} />);
    for (const row of mergedRows()) expect(row).not.toMatch(/EGP|\d+\.\d\d/);
  });

  it('turns over when the stream says the winner is revealed, with the prize, no reload', () => {
    render(<GiveawayLive slug="online" initial={base} />);
    expect(FakeEventSource.last?.url).toMatch(/\/giveaway\/online\/events$/);
    act(() => {
      FakeEventSource.last?.emit('giveaway', revealed);
    });
    expect(screen.getByTestId('giveaway-card')).toHaveAttribute('data-state', 'REVEALED');
    expect(screen.getByText("TODAY'S WINNER")).toBeInTheDocument();
    expect(screen.getByText('Phone ending •• 01')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Congratulations, ${LONG_NAME}!`))).toBeInTheDocument();
    const shown = screen.getByTestId('giveaway-prize');
    expect(within(shown).getByText('Oud gift box')).toBeInTheDocument();
    expect(within(shown).getByText('Three oud oils in a lacquered case.')).toBeInTheDocument();
    expect(shown.querySelector('img')).toHaveAttribute('src', prize.imageUrl);
    expect(screen.getByTestId('giveaway-count')).toHaveTextContent('3 entrants in the draw');
  });

  it('a page opened after the reveal shows the prize video', () => {
    render(
      <GiveawayLive
        slug="booth"
        initial={{ ...revealed, pool: 'BOOTH', prize: { ...prize, mediaKind: 'video' } }}
      />,
    );
    const shown = screen.getByTestId('giveaway-prize');
    expect(shown.querySelector('video')).toHaveAttribute('src', prize.imageUrl);
  });

  it('a new entrant arrives live, on top', () => {
    render(<GiveawayLive slug="online" initial={base} />);
    act(() => {
      FakeEventSource.last?.emit('giveaway', {
        ...base,
        entrantCount: 4,
        entrants: [
          { ref: 4, name: 'Nour Khaled', phoneTail: '03', qualifiedAt: '2026-10-01T10:00:00.000Z' },
          ...(base.entrants ?? []),
        ],
      });
    });
    expect(mergedRows()[0]).toContain('Nour Khaled');
    expect(screen.getByTestId('giveaway-count')).toHaveTextContent('4 entrants so far');
  });

  it('switched off shows the closed page', () => {
    render(<GiveawayLive slug="booth" initial={{ ...base, state: 'OFF', entrantCount: 0 }} />);
    expect(screen.getByText('No giveaway running right now')).toBeInTheDocument();
  });
});
