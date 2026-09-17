'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const Confetti = dynamic(() => import('react-confetti-boom'), { ssr: false });

const COLORS = ['#B0924F', '#C9B483', '#E4D7B4', '#1A1815', '#5C564C'];
const HARD_STOP_MS = 28_000;
const FIRST_BURST_DELAY_MS = 160;

type BurstKind = 'boom' | 'fall' | 'both';

interface Burst {
  id: number;
  kind: BurstKind;
  x: number;
}

function randomKind(): BurstKind {
  const roll = Math.random();
  if (roll < 0.38) return 'boom';
  if (roll < 0.72) return 'fall';
  return 'both';
}

/**
 * The checkout's one celebratory moment. It deliberately owns no success
 * copy: if motion is unavailable, the order number remains the confirmation.
 */
export default function OrderCelebration({ orderNumber }: { orderNumber: string | null }) {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    if (!orderNumber) return;

    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const deadline = Date.now() + HARD_STOP_MS;
    const expiryTimers = new Set<number>();
    let nextTimer: number | undefined;
    let finished = false;
    let sequence = 0;

    const clearNext = () => {
      if (nextTimer !== undefined) window.clearTimeout(nextTimer);
      nextTimer = undefined;
    };

    const clearBursts = () => {
      expiryTimers.forEach((timer) => window.clearTimeout(timer));
      expiryTimers.clear();
      setBursts([]);
    };

    const pause = () => {
      clearNext();
      clearBursts();
    };

    const canAnimate = () =>
      !finished &&
      Date.now() < deadline &&
      document.visibilityState !== 'hidden' &&
      !motionQuery?.matches;

    const fire = () => {
      if (!canAnimate()) return;

      const kind = randomKind();
      const burst: Burst = {
        id: sequence++,
        kind,
        // Keep the explosion close to the centred confirmation, while still
        // letting successive bursts feel hand-tossed rather than mechanical.
        x: 0.34 + Math.random() * 0.32,
      };
      setBursts((current) => [...current, burst]);

      const lifetime = kind === 'boom' ? 3_600 : 5_800;
      const expiry = window.setTimeout(() => {
        expiryTimers.delete(expiry);
        setBursts((current) => current.filter((candidate) => candidate.id !== burst.id));
      }, lifetime);
      expiryTimers.add(expiry);
    };

    const schedule = (delay = 2_400 + Math.random() * 2_000) => {
      clearNext();
      if (!canAnimate()) return;
      nextTimer = window.setTimeout(() => {
        nextTimer = undefined;
        fire();
        schedule();
      }, delay);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') pause();
      else schedule(FIRST_BURST_DELAY_MS);
    };

    const handleMotionPreference = () => {
      if (motionQuery?.matches) pause();
      else schedule(FIRST_BURST_DELAY_MS);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    if (motionQuery?.addEventListener) {
      motionQuery.addEventListener('change', handleMotionPreference);
    } else {
      motionQuery?.addListener?.(handleMotionPreference);
    }

    schedule(FIRST_BURST_DELAY_MS);
    const hardStopTimer = window.setTimeout(() => {
      finished = true;
      pause();
    }, HARD_STOP_MS);

    return () => {
      finished = true;
      clearNext();
      clearBursts();
      window.clearTimeout(hardStopTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (motionQuery?.removeEventListener) {
        motionQuery.removeEventListener('change', handleMotionPreference);
      } else {
        motionQuery?.removeListener?.(handleMotionPreference);
      }
    };
  }, [orderNumber]);

  if (!orderNumber || bursts.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="order-celebration"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {bursts.map((burst) => (
        <div key={burst.id}>
          {(burst.kind === 'boom' || burst.kind === 'both') && (
            <Confetti
              key={`${burst.id}-boom`}
              mode="boom"
              x={burst.x}
              y={0.48}
              particleCount={34}
              shapeSize={9}
              spreadDeg={88}
              launchSpeed={1.1}
              opacityDeltaMultiplier={1.25}
              colors={COLORS}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            />
          )}
          {(burst.kind === 'fall' || burst.kind === 'both') && (
            <Confetti
              key={`${burst.id}-fall`}
              mode="fall"
              particleCount={18}
              shapeSize={7}
              fadeOutHeight={0.82}
              colors={COLORS}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
