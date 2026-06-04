import type { SpringConfig } from './spring';
import { MR_SPRING } from './presets';

const PERSONALITY_SPRINGS: Record<string, SpringConfig> = {
  luxury:    { ...MR_SPRING.luxury },
  ios:       { ...MR_SPRING.default },
  energetic: { stiffness: 420, damping: 24, mass: 1 },
};

let _personality = 'ios';

export function setMotionPersonality(p: string): void {
  _personality = p;
}

export function getPersonalitySpring(named = 'default'): SpringConfig {
  const base = MR_SPRING[named] ?? MR_SPRING.default;
  const override = PERSONALITY_SPRINGS[_personality] ?? PERSONALITY_SPRINGS.ios;
  const ratio = override.stiffness / MR_SPRING.default.stiffness;
  return {
    stiffness: base.stiffness * ratio,
    damping: base.damping * (override.damping / MR_SPRING.default.damping),
    mass: 1,
  };
}
