import { z } from 'zod';
import { isCardNumber } from '../utils/luhn.js';

export const noCardNumberRefinement = (val: string) => !isCardNumber(val);

export const signupRequestSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter your name.')
      .max(60, 'Enter your name.')
      .refine(
        noCardNumberRefinement,
        "Don't enter card numbers. SwipeWise only needs the card name."
      ),
    email: z.string().trim().email('Enter a valid email address.'),
    password: z
      .string()
      .min(8, 'Use 8 or more characters with at least one number.')
      .refine(
        (val) => /\d/.test(val),
        'Use 8 or more characters with at least one number.'
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  });

export type SignupRequest = z.infer<typeof signupRequestSchema>;
