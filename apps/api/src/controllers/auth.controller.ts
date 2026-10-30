import { Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import { SignJWT } from 'jose';
import { signupRequestSchema } from '@swipewise/shared';
import { userRepo } from '../repositories/user.repository.js';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'swipewise-secret-key-must-be-at-least-32-chars-long'
);

export async function signupHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = signupRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid request body.',
          details: parseResult.error.issues,
        },
      });
      return;
    }

    const { name, email, password } = parseResult.data;

    // Check if user already exists (case-insensitively)
    const existing = userRepo.findByEmail(email);
    if (existing) {
      res.status(409).json({
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email already exists. Log in instead?',
        },
      });
      return;
    }

    // Hash password with argon2id
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    const user = userRepo.create({
      name,
      email,
      passwordHash,
    });

    // Generate JWT
    const token = await new SignJWT({ sub: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

    // Set httpOnly cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
}
