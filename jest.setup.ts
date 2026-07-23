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
