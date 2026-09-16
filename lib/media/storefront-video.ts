/**
 * The arithmetic and wording behind the storefront player's ring (#135), kept
 * out of the component so it can be pinned without a DOM.
 */

/** What the player is doing — and so which icon sits in the ring. */
export type PlayerStatus = 'playing' | 'paused' | 'ended';

/**
 * `stroke-dashoffset` for a ring of `circumference` that has filled by
 * `currentTime / duration`: the full circumference when empty, 0 when full.
 *
 * A duration the browser does not know yet (NaN before metadata, 0, or
 * Infinity for a stream) draws an empty ring rather than a NaN offset, which
 * SVG would render as a complete circle — a finished-looking ring on a video
 * that has not started.
 */
export function ringOffset(currentTime: number, duration: number, circumference: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return circumference;
  const progress = Math.min(1, Math.max(0, currentTime / duration));
  return circumference * (1 - progress);
}

/** The button names the action it will take, not the state it is in. */
export function controlLabel(status: PlayerStatus): string {
  if (status === 'playing') return 'Pause video';
  if (status === 'ended') return 'Replay video';
  return 'Play video';
}
