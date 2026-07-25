import { z } from 'zod';
import { passwordField, PASSWORD_HELPER } from './password';

export { PASSWORD_HELPER };

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  remember: z.boolean().optional(),
});

export const signupSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required'),
    lastName: z.string().trim().min(1, 'Last name is required'),
    email: z.string().email('Enter a valid email address'),
    // Dial code and the local number are separate fields in the form so the
    // shopper never has to know the + prefix; they are joined into one E.164
    // string for the API.
    dialCode: z.string().regex(/^\+\d{1,4}$/, 'Select a country'),
    phoneNumber: z
      .string()
      .trim()
      .min(1, 'Phone number is required')
      .refine((v) => /^\d[\d\s-]*$/.test(v), 'Digits only')
      .refine(
        (v) => {
          const digits = v.replace(/\D/g, '').replace(/^0+/, '');
          return digits.length >= 6 && digits.length <= 14;
        },
        'Enter a valid phone number',
      ),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * A local number joined to its dial code as E.164, which is what the API takes.
 * The leading zero of a national trunk prefix is dropped — an Egyptian shopper
 * types 01001234567 and means +201001234567, not +2001001234567.
 */
export function toE164(dialCode: string, phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '').replace(/^0+/, '');
  return `${dialCode}${digits}`;
}

export const forgotSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type ForgotFormData = z.infer<typeof forgotSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
