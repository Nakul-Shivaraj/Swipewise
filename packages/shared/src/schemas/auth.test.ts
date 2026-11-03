import { describe, it, expect } from 'vitest';
import { signupRequestSchema, loginRequestSchema } from './auth.js';
import { calculatePasswordStrength } from '../utils/password-strength.js';
import { isCardNumber } from '../utils/luhn.js';

describe('Sign up validation schemas (US-01)', () => {
  it('AC1: accepts valid sign-up inputs', () => {
    const validData = {
      name: 'Nakul Shivaraj',
      email: 'nakul@example.com',
      password: 'Password123',
      confirmPassword: 'Password123',
    };
    const result = signupRequestSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('AC2: requires name between 1 and 60 chars', () => {
    const emptyName = signupRequestSchema.safeParse({
      name: '',
      email: 'user@example.com',
      password: 'Password123',
      confirmPassword: 'Password123',
    });
    expect(emptyName.success).toBe(false);
    if (!emptyName.success) {
      expect(emptyName.error.issues[0].message).toBe('Enter your name.');
    }
  });

  it('AC2: requires valid email format', () => {
    const badEmail = signupRequestSchema.safeParse({
      name: 'Nakul',
      email: 'not-an-email',
      password: 'Password123',
      confirmPassword: 'Password123',
    });
    expect(badEmail.success).toBe(false);
    if (!badEmail.success) {
      expect(badEmail.error.issues[0].message).toBe('Enter a valid email address.');
    }
  });

  it('AC2: requires password with at least 8 chars and at least one number', () => {
    const shortPass = signupRequestSchema.safeParse({
      name: 'Nakul',
      email: 'user@example.com',
      password: 'Pass1',
      confirmPassword: 'Pass1',
    });
    expect(shortPass.success).toBe(false);
    if (!shortPass.success) {
      expect(shortPass.error.issues[0].message).toBe(
        'Use 8 or more characters with at least one number.'
      );
    }

    const noNumPass = signupRequestSchema.safeParse({
      name: 'Nakul',
      email: 'user@example.com',
      password: 'PasswordWithoutNumbers',
      confirmPassword: 'PasswordWithoutNumbers',
    });
    expect(noNumPass.success).toBe(false);
    if (!noNumPass.success) {
      expect(noNumPass.error.issues[0].message).toBe(
        'Use 8 or more characters with at least one number.'
      );
    }
  });

  it('AC2: requires passwords to match', () => {
    const mismatch = signupRequestSchema.safeParse({
      name: 'Nakul',
      email: 'user@example.com',
      password: 'Password123',
      confirmPassword: 'DifferentPassword123',
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues[0].message).toBe("Passwords don't match.");
    }
  });

  it('AC5: card-number guard rejects runs of 13-19 digits that pass Luhn check', () => {
    // Visa test number
    expect(isCardNumber('4111111111111111')).toBe(true);
    // Plain text
    expect(isCardNumber('Nakul Shivaraj')).toBe(false);

    const withCardNumber = signupRequestSchema.safeParse({
      name: '4111111111111111',
      email: 'user@example.com',
      password: 'Password123',
      confirmPassword: 'Password123',
    });
    expect(withCardNumber.success).toBe(false);
    if (!withCardNumber.success) {
      expect(withCardNumber.error.issues[0].message).toBe(
        "Don't enter card numbers. SwipeWise only needs the card name."
      );
    }
  });

  it('AC2: calculates 4-segment password strength and helper text', () => {
    expect(calculatePasswordStrength('')).toEqual({ score: 0, label: 'Weak' });
    expect(calculatePasswordStrength('abc')).toEqual({ score: 1, label: 'Weak' });
    expect(calculatePasswordStrength('abc12345')).toEqual({ score: 2, label: 'Okay' });
    expect(calculatePasswordStrength('Abc12345!')).toEqual({ score: 4, label: 'Strong password' });
  });
});


describe('Log in validation schema (US-01 / Issue #10)', () => {
  it('AC2: accepts valid login inputs', () => {
    const result = loginRequestSchema.safeParse({
      email: 'user@example.com',
      password: 'Password123',
    });
    expect(result.success).toBe(true);
  });

  it('AC2: validates email and non-empty password', () => {
    const badEmail = loginRequestSchema.safeParse({
      email: 'not-an-email',
      password: 'Password123',
    });
    expect(badEmail.success).toBe(false);

    const emptyPass = loginRequestSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });
    expect(emptyPass.success).toBe(false);
  });
});
