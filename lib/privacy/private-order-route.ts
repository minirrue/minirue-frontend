/** Bearer review tokens must never be forwarded to telemetry, including auth return URLs. */
export function isPrivateOrderRoute(pathname: string, search = ''): boolean {
  if (pathname.startsWith('/booth/review/')) return true;
  const params = new URLSearchParams(search);
  return ['next', 'returnUrl'].some(key => params.get(key)?.startsWith('/booth/review/'));
}

export function isPrivateOrderLocation(): boolean {
  return typeof window !== 'undefined' && isPrivateOrderRoute(window.location.pathname, window.location.search);
}
