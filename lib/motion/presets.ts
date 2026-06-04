import type { SpringConfig } from './spring';

export const MR_SPRING: Record<string, SpringConfig> = {
  default:     { stiffness: 300, damping: 30,  mass: 1 },
  interactive: { stiffness: 700, damping: 55,  mass: 1 },
  navigation:  { stiffness: 350, damping: 35,  mass: 1 },
  popover:     { stiffness: 500, damping: 35,  mass: 1 },
  sheet:       { stiffness: 400, damping: 40,  mass: 1 },
  bouncy:      { stiffness: 200, damping: 12,  mass: 1 },
  banner:      { stiffness: 280, damping: 28,  mass: 1 },
  luxury:      { stiffness: 180, damping: 28,  mass: 1 },
};

export const MR_TX = {
  hover: 'transform var(--mp-dur-hover) var(--mr-ease-spring), box-shadow var(--mr-dur-fast) var(--mr-ease-out), background-color var(--mr-dur-fast) var(--mr-ease-snappy), color var(--mr-dur-fast) var(--mr-ease-snappy)',
  press: 'transform var(--mr-dur-instant) var(--mr-ease-snappy)',
} as const;
