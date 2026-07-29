import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names and lets later Tailwind utilities win over earlier ones of
 * the same kind (`p-2 p-4` resolves to `p-4` rather than fighting in the
 * cascade). Required by the motion-primitives components.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
