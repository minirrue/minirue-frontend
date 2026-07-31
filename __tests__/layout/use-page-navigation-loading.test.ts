import { renderHook, act } from '@testing-library/react';
import {
  usePageNavigationLoading,
  __resetHistoryPatchForTests,
} from '@/lib/navigation/usePageNavigationLoading';

let mockPathname = '/a';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

/**
 * Task 43 (2026-07-31): the hook behind PageLoader, tested directly against
 * both navigation directions and the in-page cases it must ignore.
 */
describe('usePageNavigationLoading', () => {
  beforeEach(() => {
    mockPathname = '/a';
    __resetHistoryPatchForTests();
    window.history.replaceState({}, '', '/a');
  });

  it('is false at rest', () => {
    const { result } = renderHook(() => usePageNavigationLoading());
    expect(result.current).toBe(false);
  });

  it('becomes true when history.pushState changes the pathname (a Link click / router.push)', () => {
    const { result } = renderHook(() => usePageNavigationLoading());
    act(() => {
      window.history.pushState({}, '', '/b');
    });
    expect(result.current).toBe(true);
  });

  it('does NOT fire for a pushState that only changes searchParams (a filter, same page)', () => {
    const { result } = renderHook(() => usePageNavigationLoading());
    act(() => {
      window.history.pushState({}, '', '/a?sort=price');
    });
    expect(result.current).toBe(false);
  });

  it('does NOT fire for a hash-only change', () => {
    const { result } = renderHook(() => usePageNavigationLoading());
    act(() => {
      window.history.pushState({}, '', '/a#section');
    });
    expect(result.current).toBe(false);
  });

  it('becomes true on a popstate (Back/Forward/swipe-back) that changes the pathname', () => {
    const { result } = renderHook(() => usePageNavigationLoading());
    act(() => {
      // Real Back never calls pushState — the browser already owns this
      // history entry; only `popstate` fires.
      History.prototype.pushState.call(window.history, {}, '', '/b');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current).toBe(true);
  });

  it('does not fire on a popstate that lands back on the same pathname', () => {
    const { result } = renderHook(() => usePageNavigationLoading());
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current).toBe(false);
  });

  it('goes false once usePathname reports the destination as committed', () => {
    const { result, rerender } = renderHook(() => usePageNavigationLoading());
    act(() => {
      window.history.pushState({}, '', '/b');
    });
    expect(result.current).toBe(true);

    mockPathname = '/b';
    rerender();
    expect(result.current).toBe(false);
  });
});
