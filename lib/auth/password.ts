import { z } from 'zod';

/** Matches backend `RegisterDto` / `IsStrongPassword` (8+ chars, upper, lower, number). */
export const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value), {
    message: 'Include uppercase and lowercase letters',
  })
  .refine((value) => /\d/.test(value), {
    message: 'Include at least one number',
  });

export const PASSWORD_HELPER =
  'At least 8 characters with uppercase, lowercase, and a number';
