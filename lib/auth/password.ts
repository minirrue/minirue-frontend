import { z } from 'zod';

/**
 * Eight characters. That is the whole rule.
 *
 * Its exact counterpart is `@MinLength(8)` on the backend's `RegisterDto` and
 * `ResetPasswordDto`, and the two must stay identical — they drifted once and
 * it cost a shopper their sign-up. This field used to also demand upper, lower
 * and a digit, while the API used `@IsStrongPassword`, whose options object
 * replaces only the keys you name: the unlisted `minSymbols` kept its default
 * of 1. So the API silently required a symbol that this form never asked for
 * and never mentioned in its helper text, and a password that passed here came
 * back "password is not strong enough" (2026-08-01).
 *
 * Deliberately not hardened beyond length (owner: "do not harden password
 * creation, only rule is 8 or more characters").
 */
export const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters');

export const PASSWORD_HELPER = 'At least 8 characters';
