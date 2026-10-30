import { Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import { SignJWT } from 'jose';
import { signupRequestSchema, loginRequestSchema } from '@swipewise/shared';
import { userRepo as defaultUserRepo, UserRepository } from '../repositories/user.repository.js';
import { getJwtSecret, AuthenticatedRequest } from '../middleware/auth.middleware.js';

function getRepo(req: Request): UserRepository {
  return (req.app.get('userRepo') as UserRepository) || defaultUserRepo;
}

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
    const repo = getRepo(req);

    // Check if user already exists (case-insensitively)
    const existing = await repo.findByEmail(email);
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

    const user = await repo.create({
      name,
      email,
      passwordHash,
    });

    // Generate JWT
    const token = await new SignJWT({ sub: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(getJwtSecret());

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

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = loginRequestSchema.safeParse(req.body);

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

    const { email, password } = parseResult.data;
    const repo = getRepo(req);

    const user = await repo.findByEmail(email);
    if (!user) {
      res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email or password is incorrect.',
        },
      });
      return;
    }

    const isValid = await argon2.verify(user.passwordHash, password);
    if (!isValid) {
      res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email or password is incorrect.',
        },
      });
      return;
    }

    // Generate JWT
    const token = await new SignJWT({ sub: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(getJwtSecret());

    // Set httpOnly cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(200).json({
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

export async function logoutHandler(
  _req: Request,
  res: Response
): Promise<void> {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  res.status(200).json({
    message: 'Logged out successfully.',
  });
}

export async function meHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
      return;
    }

    const repo = getRepo(req);
    const user = await repo.findById(authReq.user.id);

    if (!user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
      return;
    }

    res.status(200).json({
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
