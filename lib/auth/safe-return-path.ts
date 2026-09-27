/** Auth destinations are local paths; backslashes also form network URLs in browsers. */
export function safeReturnPath(target: string | null, fallback = '/'): string {
  return target?.startsWith('/') && !target.startsWith('//') && !/[\\\u0000-\u001f]/.test(target) ? target : fallback;
}
