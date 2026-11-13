import { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";
import {
  userRepo as defaultUserRepo,
  UserRepository,
} from "../repositories/user.repository.js";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function getJwtSecret(): Uint8Array {
  const secret =
    process.env.JWT_SECRET ||
    "swipewise-development-and-test-jwt-secret-minimum-32-chars-long";
  return new TextEncoder().encode(secret);
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.auth_token;

  if (!token) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
    return;
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.sub || typeof payload.sub !== "string") {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    (req as AuthenticatedRequest).user = {
      id: payload.sub,
      email: (payload.email as string) || "",
    };
    next();
  } catch {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
    return;
  }

  const repo = (req.app.get("userRepo") as UserRepository) || defaultUserRepo;
  const user = await repo.findById(authReq.user.id);

  if (!user || user.role !== "ADMIN") {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Admin access required.",
      },
    });
    return;
  }

  authReq.user.role = user.role;
  next();
}
