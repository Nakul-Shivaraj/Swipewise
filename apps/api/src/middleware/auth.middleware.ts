import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function getJwtSecret(): Uint8Array {
  const secret =
    process.env.JWT_SECRET ||
    'swipewise-development-and-test-jwt-secret-minimum-32-chars-long';
  return new TextEncoder().encode(secret);
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.auth_token;

  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      },
    });
    return;
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.sub || typeof payload.sub !== 'string') {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
      return;
    }

    (req as AuthenticatedRequest).user = {
      id: payload.sub,
      email: (payload.email as string) || '',
    };
    next();
  } catch {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      },
    });
  }
}
