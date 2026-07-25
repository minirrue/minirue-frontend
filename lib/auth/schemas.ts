import { z } from 'zod';
import { passwordField, PASSWORD_HELPER } from './password';
import { phoneProblem, toE164 } from './dial-codes';

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
    phoneNumber: z.string().trim().min(1, 'Phone number is required'),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  // The number can only be judged against its country, so this has to see both
  // fields — a 10-digit Egyptian mobile and a 9-digit Saudi one are both right.
  .superRefine((d, ctx) => {
    const problem = phoneProblem(d.dialCode, d.phoneNumber);
    if (problem) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phoneNumber'],
        message: problem,
      });
    }
  });

export { toE164 };

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
