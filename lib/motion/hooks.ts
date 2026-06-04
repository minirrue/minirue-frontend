'use client';

import React from 'react';
import type { SpringConfig } from './spring';
import { stepSpring } from './spring';
import { MR_SPRING } from './presets';
import { getPersonalitySpring } from './personality';

/* ─── useSpringValue ─────────────────────────────────────── */
export function useSpringValue(
  to: number,
  preset: string | SpringConfig = 'default',
  deps: React.DependencyList = [],
): number {
  const config: SpringConfig =
    typeof preset === 'string' ? (MR_SPRING[preset] ?? MR_SPRING.default) : preset;
  const [val, setVal] = React.useState(to);
  const state = React.useRef({ x: to, v: 0, raf: 0, last: 0 });

  React.useEffect(() => {
    cancelAnimationFrame(state.current.raf);
    state.current.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - state.current.last) / 1000);
      state.current.last = now;
      const r = stepSpring(state.current.x, state.current.v, to, config, dt);
      state.current.x = r.x;
      state.current.v = r.v;
      setVal(r.x);
      if (!r.done) {
        state.current.raf = requestAnimationFrame(tick);
      } else {
        setVal(to);
      }
    };
    state.current.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(state.current.raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, ...deps]);

  return val;
}

/* ─── useEnterSpring ─────────────────────────────────────── */
export interface EnterSpringOptions {
  preset?: string;
  from?: { y?: number; opacity?: number; scale?: number };
  delay?: number;
}

export function useEnterSpring(options: EnterSpringOptions = {}): React.CSSProperties {
  const { preset = 'default', from = { y: 16, opacity: 0, scale: 1 }, delay = 0 } = options;
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setActive(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  // Safety: if hooks don't fire on client (React Compiler edge, Lenis, etc.), force visibility
  React.useEffect(() => {
    const safety = setTimeout(() => setActive(true), 400 + delay);
    return () => clearTimeout(safety);
  }, [delay]);

  const spring = getPersonalitySpring(preset);
  const y = useSpringValue(active ? 0 : (from.y ?? 0), spring, [active]);
  const scale = useSpringValue(active ? 1 : (from.scale ?? 1), spring, [active]);
  // Content always visible — animate transform only. Opacity fallback stays at 1 to prevent stuck-invisible.
  const opacity = 1;

  return {
    transform: `translate3d(0,${y}px,0) scale(${scale})`,
    opacity,
    willChange: 'transform, opacity',
    transition: 'transform 340ms cubic-bezier(0.16,1,0.3,1)',
  };
}

/* ─── useStaggerEnter ────────────────────────────────────── */
export interface StaggerEnterOptions extends Omit<EnterSpringOptions, 'delay'> {
  step?: number;
  baseDelay?: number;
}

export function useStaggerEnter(
  index: number,
  options: StaggerEnterOptions = {},
): React.CSSProperties {
  const { step = 55, baseDelay = 0, ...rest } = options;
  return useEnterSpring({ ...rest, delay: baseDelay + index * step });
}

/* ─── useScrollReveal ────────────────────────────────────── */
export interface ScrollRevealOptions {
  preset?: string;
  from?: { y?: number; opacity?: number; scale?: number };
  threshold?: number;
  once?: boolean;
  delay?: number;
}

export interface ScrollRevealResult {
  ref: React.RefObject<HTMLDivElement | null>;
  style: React.CSSProperties;
}

export function useScrollReveal(options: ScrollRevealOptions = {}): ScrollRevealResult {
  const {
    preset = 'default',
    from = { y: 24, opacity: 0, scale: 1 },
    threshold = 0.18,
    once = true,
    delay = 0,
  } = options;

  const ref = React.useRef<HTMLDivElement | null>(null);
  const [seen, setSeen] = React.useState(false);

  React.useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    // Immediate reveal if already in viewport on mount (prevents stuck-invisible above-fold content)
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const alreadyVisible = rect.top < vh && rect.bottom > 0;
    if (alreadyVisible) {
      setSeen(true);
      if (once) return;
    }

    // IntersectionObserver fallback for off-screen elements
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setSeen(true);
            if (once) io.disconnect();
          } else if (!once) {
            setSeen(false);
          }
        });
      },
      { threshold },
    );
    io.observe(el);

    // Safety fallback: reveal after 1.5s even if IO never fires (slow IO, hidden parent, etc.)
    const safety = setTimeout(() => setSeen(true), 1500);

    return () => {
      io.disconnect();
      clearTimeout(safety);
    };
  }, [threshold, once]);

  const spring = getPersonalitySpring(preset);
  const y = useSpringValue(seen ? 0 : (from.y ?? 0), spring, [seen]);
  const scale = useSpringValue(seen ? 1 : (from.scale ?? 1), spring, [seen]);

  return {
    ref,
    style: {
      transform: `translate3d(0,${y}px,0) scale(${scale})`,
      // Always visible — animate transform only. Prevents stuck-invisible when IO fails.
      opacity: 1,
      transition: `transform 340ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      willChange: 'transform, opacity',
    },
  };
}

/* ─── useCrossfade ───────────────────────────────────────── */
export interface CrossfadeResult {
  display: string;
  style: React.CSSProperties;
}

export function useCrossfade(value: string): CrossfadeResult {
  const [display, setDisplay] = React.useState(value);
  const [phase, setPhase] = React.useState<'idle' | 'out' | 'in'>('idle');
  const prev = React.useRef(value);

  React.useEffect(() => {
    if (prev.current === value) return;
    setPhase('out');
    const t1 = setTimeout(() => {
      setDisplay(value);
      setPhase('in');
      prev.current = value;
    }, 140);
    const t2 = setTimeout(() => setPhase('idle'), 420);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [value]);

  return {
    display,
    style: {
      display: 'inline-block',
      transform: phase === 'out' ? 'translateY(-4px)' : 'translateY(0)',
      opacity: phase === 'out' ? 0 : 1,
      transition:
        'opacity 160ms cubic-bezier(0.16,1,0.3,1), transform 240ms cubic-bezier(0.25,0.46,0.45,0.94)',
      willChange: 'transform, opacity',
    },
  };
}

/* ─── useCountUp ─────────────────────────────────────────── */
export interface CountUpResult {
  ref: React.RefObject<HTMLDivElement | null>;
  count: number;
}

export function useCountUp(target: number, duration = 1200): CountUpResult {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const seen = React.useRef(false);
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !seen.current) {
          seen.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            setCount(Math.round(target * eased));
            if (p < 1) {
              requestAnimationFrame(tick);
            } else {
              setCount(target);
            }
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [target, duration]);

  return { ref, count };
}
