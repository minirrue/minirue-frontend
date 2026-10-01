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
    { ref: 3, name: 'Omar Hassan', phoneTail: '72', qualifiedAt: '2026-10-01T09:30:00.000Z' },
    { ref: 2, name: 'Laila Mahmoud', phoneTail: '58', qualifiedAt: '2026-10-01T09:00:00.000Z' },
    { ref: 1, name: LONG_NAME, phoneTail: '49', qualifiedAt: '2026-10-01T08:00:00.000Z' },
  ],
  winner: null,
};

/** Every row as it reads: the entry number, then the full name. */
const ROWS = ['No. 03Omar Hassan', 'No. 02Laila Mahmoud', `No. 01${LONG_NAME}`];

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
  winner: { ref: 1, name: LONG_NAME, phoneTail: '49' },
};

/** Anything that would show who someone is beyond their name, or when. */
const PHONE_OR_TIME = /••|\b(72|58|49)\b|\d{1,2}:\d{2}|\b(AM|PM)\b/;

function readCss(): string {
  return readFileSync(join(process.cwd(), 'components/giveaway/giveaway.module.css'), 'utf8');
}

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
    const card = screen.getByTestId('giveaway-card');
    expect(card).toHaveAttribute('data-state', 'OPEN');
    expect(screen.queryByText("TODAY'S WINNER")).toBeNull();
    expect(screen.queryByTestId('giveaway-winner-name')).toBeNull();
    expect(screen.getByText(/revealed at 10:00 PM/)).toBeInTheDocument();
    expect(screen.queryByTestId('giveaway-prize')).toBeNull();
    expect(screen.queryByText(/prize/i)).toBeNull();
    expect(card.querySelector('img, video, figure')).toBeNull();
  });

  it('never shows a prize before the reveal, even if an older backend sent one', () => {
    for (const state of ['OPEN', 'DRAWN', 'PENDING_DRAW'] as const) {
      const { unmount } = render(
        <GiveawayLive
          slug="online"
          initial={{ ...base, state, prize, winner: { ref: 1, name: LONG_NAME, phoneTail: '49' } }}
        />,
      );
      expect(screen.queryByTestId('giveaway-prize')).toBeNull();
      expect(screen.queryByText('Oud gift box')).toBeNull();
      expect(screen.queryByText(/Three oud oils/)).toBeNull();
      expect(screen.queryByText(/prize/i)).toBeNull();
      expect(document.querySelector('img, video')).toBeNull();
      expect(screen.queryByTestId('giveaway-winner-name')).toBeNull();
      unmount();
    }
  });

  it('a row is the entry number and the full name, nothing else', () => {
    render(<GiveawayLive slug="online" initial={base} />);
    const rows = mergedRows();
    expect(rows).toEqual(ROWS);
    for (const row of rows) expect(row).not.toMatch(PHONE_OR_TIME);
    expect(screen.getAllByText(LONG_NAME).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Omar Hassan').length).toBeGreaterThan(0);
  });

  it('never shows anyone masked: a row without a name is left out, with no placeholder', () => {
    const withNameless = {
      ...base,
      entrants: [
        ...(base.entrants ?? []),
        { ref: 4, name: null, phoneTail: '31', qualifiedAt: '2026-10-01T09:45:00.000Z' },
        { ref: 5, name: '  ', phoneTail: '32', qualifiedAt: '2026-10-01T09:50:00.000Z' },
      ],
    };
    render(<GiveawayLive slug="online" initial={withNameless} />);
    expect(mergedRows()).toEqual(ROWS);
    expect(screen.queryByText(/No\. 0[45]/)).toBeNull();
    // No "Entrant" stand-in anywhere (the headings say "Entrants").
    expect(document.body.textContent).not.toMatch(/\bEntrant\b(?!s)/);
    expect(document.body.textContent).not.toMatch(/Anonymous|Hidden/i);
  });

  it('has no hidden-name styling, and never cuts a name short in the stylesheet', () => {
    const css = readCss();
    expect(css).not.toMatch(/nameHidden/);
    for (const cls of ['name', 'winnerName']) {
      const rule = css.match(new RegExp(`\\.${cls} \\{([^}]*)\\}`))?.[1];
      expect(rule).toBeDefined();
      expect(rule).not.toMatch(/text-overflow|white-space:\s*nowrap|overflow:\s*hidden|line-clamp/);
    }
  });

  it('says that asking not to be listed takes you out of the draw', () => {
    render(<GiveawayLive slug="online" initial={base} />);
    expect(
      screen.getByText(
        "Entrants are listed by name, the latest first. Ask us if you would rather not take part and we will take you out of today's draw.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/you stay in the draw/)).toBeNull();
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
    expect(mergedRows()).toEqual(ROWS);
  });

  it('on wide screens reads down the latest half, then the earlier half', () => {
    render(<GiveawayLive slug="online" initial={base} />);
    const [left] = screen.getAllByRole('region', { name: 'Entrants' });
    const leftRows = within(left).getAllByRole('listitem').map((li) => li.textContent);
    expect(leftRows).toEqual(ROWS.slice(0, 2));
    const earlier = screen.getByRole('region', { name: 'Earlier' });
    expect(within(earlier).getAllByRole('listitem').map((li) => li.textContent)).toEqual(ROWS.slice(2));
  });

  it('shows how many have entered', () => {
    render(<GiveawayLive slug="online" initial={base} />);
    expect(screen.getByTestId('giveaway-count')).toHaveTextContent('3 entrants so far');
    const merged = screen.getAllByRole('region', { name: 'Entrants' }).at(-1) as HTMLElement;
    expect(within(merged).getByText('3 entrants')).toBeInTheDocument();
  });

  it('counts the list when an older payload has no entrantCount', () => {
    const older = { ...base, entrantCount: undefined, entrants: base.entrants?.slice(0, 1) };
    render(<GiveawayLive slug="online" initial={older} />);
    expect(screen.getByTestId('giveaway-count')).toHaveTextContent('1 entrant so far');
  });

  it('shows no amount against anyone', () => {
    render(<GiveawayLive slug="online" initial={base} />);
    for (const row of mergedRows()) expect(row).not.toMatch(/EGP|\d+\.\d\d/);
    act(() => {
      FakeEventSource.last?.emit('giveaway', revealed);
    });
    expect(screen.getByTestId('giveaway-card')).not.toHaveTextContent(/EGP|\d+\.\d\d/);
    for (const row of mergedRows()) expect(row).not.toMatch(/EGP|\d+\.\d\d/);
  });

  it('turns over to the prize and the winner, both on the card, with nothing below it', () => {
    render(<GiveawayLive slug="online" initial={base} />);
    expect(FakeEventSource.last?.url).toMatch(/\/giveaway\/online\/events$/);
    act(() => {
      FakeEventSource.last?.emit('giveaway', revealed);
    });
    const card = screen.getByTestId('giveaway-card');
    expect(card).toHaveAttribute('data-state', 'REVEALED');
    // The prize image and the winner, on the one card.
    expect(card.querySelector('img')).toHaveAttribute('src', prize.imageUrl);
    expect(within(card).getByTestId('giveaway-winner-name')).toHaveTextContent(LONG_NAME);
    expect(within(card).getByText("TODAY'S WINNER")).toBeInTheDocument();
    expect(within(card).getByText('ENTRANT NO. 01')).toBeInTheDocument();
    expect(within(card).getByText('Oud gift box')).toBeInTheDocument();
    // Only the number and the name: no phone ending on the card.
    expect(card).not.toHaveTextContent(/••|Phone ending/);
    // No separate prize panel, and no prize media anywhere but on the card.
    expect(screen.queryByTestId('giveaway-prize')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Prize' })).toBeNull();
    expect(document.querySelectorAll('img, video')).toHaveLength(card.querySelectorAll('img, video').length);
    expect(screen.queryByText(/Today's prize/)).toBeNull();
    // The congratulations line stays under the card, not on it.
    const congrats = screen.getByText(/^Congratulations/);
    expect(congrats).toHaveTextContent(`Congratulations, ${LONG_NAME}! We will call you`);
    expect(card.contains(congrats)).toBe(false);
    expect(screen.getByTestId('giveaway-count')).toHaveTextContent('3 entrants in the draw');
  });

  it('a page opened after the reveal shows the prize video on the card', () => {
    render(
      <GiveawayLive
        slug="booth"
        initial={{ ...revealed, pool: 'BOOTH', prize: { ...prize, mediaKind: 'video' } }}
      />,
    );
    const card = screen.getByTestId('giveaway-card');
    expect(card.querySelector('video')).toHaveAttribute('src', prize.imageUrl);
    expect(within(card).getByTestId('giveaway-winner-name')).toHaveTextContent(LONG_NAME);
    expect(screen.queryByTestId('giveaway-prize')).toBeNull();
  });

  it('a winner without a name still shows no placeholder on the card', () => {
    render(
      <GiveawayLive slug="booth" initial={{ ...revealed, winner: { ref: 1, name: null, phoneTail: '49' } }} />,
    );
    const card = screen.getByTestId('giveaway-card');
    expect(within(card).queryByTestId('giveaway-winner-name')).toBeNull();
    expect(within(card).getByText('ENTRANT NO. 01')).toBeInTheDocument();
    expect(card).not.toHaveTextContent(/\bEntrant\b(?!s)|••/);
  });

  it('no entries keeps its own face', () => {
    render(
      <GiveawayLive
        slug="booth"
        initial={{ ...base, state: 'NO_ENTRIES', entrantCount: 0, entrants: [], prize, winner: null }}
      />,
    );
    const card = screen.getByTestId('giveaway-card');
    expect(card).toHaveAttribute('data-state', 'NO_ENTRIES');
    expect(within(card).getByText('No entries today')).toBeInTheDocument();
    expect(document.querySelector('img, video')).toBeNull();
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
    expect(mergedRows()[0]).toBe('No. 04Nour Khaled');
    expect(screen.getByTestId('giveaway-count')).toHaveTextContent('4 entrants so far');
  });

  it('switched off shows the closed page', () => {
    render(<GiveawayLive slug="booth" initial={{ ...base, state: 'OFF', entrantCount: 0 }} />);
    expect(screen.getByText('No giveaway running right now')).toBeInTheDocument();
  });
});
