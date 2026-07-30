/**
 * Unit tests — lib/analytics/ui-click.ts
 * Covers: delegated listener fires on a nested child of a data-trace-id
 * element, does not fire without such an ancestor, and the rage-click
 * threshold.
 */
import { dequeueAll } from '@/lib/analytics/queue';
import { initUiClickTracking } from '@/lib/analytics/ui-click';

function click(el: Element): void {
  el.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 20 }),
  );
}

describe('lib/analytics/ui-click', () => {
  let cleanup: () => void;

  beforeEach(() => {
    dequeueAll();
    document.body.innerHTML = '';
    cleanup = initUiClickTracking();
  });

  afterEach(() => {
    cleanup();
  });

  it('fires ui_click when a nested child of a data-trace-id element is clicked', () => {
    document.body.innerHTML =
      '<button data-trace-id="add-to-cart"><span class="icon">+</span></button>';
    const child = document.querySelector('.icon')!;

    click(child);

    const events = dequeueAll().filter((e) => e.n === 'ui_click');
    expect(events).toHaveLength(1);
    expect(events[0].v).toMatchObject({ traceId: 'add-to-cart', tag: 'button' });
  });

  it('does not fire when there is no data-trace-id ancestor', () => {
    document.body.innerHTML = '<button>no trace id</button>';
    const button = document.querySelector('button')!;

    click(button);

    const events = dequeueAll().filter((e) => e.n === 'ui_click');
    expect(events).toHaveLength(0);
  });

  it('fires a rage_click once the same traceId is clicked 3 times within the window', () => {
    document.body.innerHTML = '<button data-trace-id="submit">Go</button>';
    const button = document.querySelector('button')!;

    click(button);
    click(button);
    let events = dequeueAll();
    expect(events.some((e) => e.n === 'rage_click')).toBe(false);

    click(button);
    events = dequeueAll();
    expect(events.some((e) => e.n === 'rage_click')).toBe(true);
  });
});
