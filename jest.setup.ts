import '@testing-library/jest-dom';

// jsdom does not implement matchMedia. Several client hooks (e.g. useIsTouch) call it at
// module load time, so any test importing a component that transitively imports those hooks
// needs this stub to exist before the import runs.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

// jsdom implements neither observer. The carousel counts its visible slides
// with an IntersectionObserver, and the Footer measures itself with a
// ResizeObserver, so both have to exist before any component module loads.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

if (typeof globalThis !== 'undefined') {
  const g = globalThis as unknown as Record<string, unknown>;
  g.IntersectionObserver ??= NoopObserver;
  g.ResizeObserver ??= NoopObserver;
}
