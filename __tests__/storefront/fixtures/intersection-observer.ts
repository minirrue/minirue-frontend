/**
 * A controllable IntersectionObserver for StorefrontVideo tests (#135).
 *
 * The player uses two: one with a `rootMargin` that decides when to start
 * buffering, one without that decides when to play. `installMockIO()` swaps the
 * global for the duration of a test and returns handles to fire each.
 */
export class MockIO {
  static all: MockIO[] = [];
  targets: Element[] = [];
  constructor(
    private cb: IntersectionObserverCallback,
    public options: IntersectionObserverInit = {},
  ) {
    MockIO.all.push(this);
  }
  observe(el: Element) {
    this.targets.push(el);
  }
  unobserve() {}
  disconnect() {
    this.targets = [];
  }
  takeRecords() {
    return [];
  }
  /** `ratio` defaults to fully visible / not at all. */
  fire(isIntersecting: boolean, ratio = isIntersecting ? 1 : 0) {
    this.cb(
      this.targets.map(
        (target) => ({ isIntersecting, target, intersectionRatio: ratio }) as IntersectionObserverEntry,
      ),
      this as unknown as IntersectionObserver,
    );
  }
}

// Only observers watching a <video>: a surrounding component (the journal's
// scroll reveal) may run observers of its own.
const live = () => MockIO.all.filter((o) => o.targets.some((t) => t.tagName === 'VIDEO'));
/** Every live "near the viewport" observer (one per player). */
export const nearObservers = () => live().filter((o) => o.options.rootMargin);
/** Every live "in view" observer (one per player). */
export const viewObservers = () => live().filter((o) => !o.options.rootMargin);
export const nearObserver = () => nearObservers().at(-1)!;
export const viewObserver = () => viewObservers().at(-1)!;

/** Brings every player on screen. */
export function scrollAllIntoView() {
  nearObservers().forEach((o) => o.fire(true));
  viewObservers().forEach((o) => o.fire(true));
}

export function installMockIO(): () => void {
  const original = globalThis.IntersectionObserver;
  MockIO.all = [];
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = MockIO;
  return () => {
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = original;
  };
}
