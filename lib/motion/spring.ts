// Spring physics integrator — ported from motion.js

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

export interface SpringState {
  x: number;
  v: number;
  done: boolean;
}

export function stepSpring(
  x: number,
  v: number,
  target: number,
  config: SpringConfig,
  dt: number,
): SpringState {
  const Fs = -config.stiffness * (x - target);
  const Fd = -config.damping * v;
  const a = (Fs + Fd) / config.mass;
  const nv = v + a * dt;
  const nx = x + nv * dt;
  const done = Math.abs(nv) < 0.015 && Math.abs(nx - target) < 0.015;
  return { x: nx, v: nv, done };
}
