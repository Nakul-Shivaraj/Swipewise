import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import {
  signupHandler,
  loginHandler,
  logoutHandler,
  meHandler,
} from "./controllers/auth.controller.js";
import {
  requireAuth,
  AuthenticatedRequest,
} from "./middleware/auth.middleware.js";
import { PostgresRateLimitStore } from "./middleware/postgres-rate-limit.js";
import { UserRepository } from "./repositories/user.repository.js";
import { prisma as defaultPrisma } from "./db.js";

export interface AppOptions {
  rateLimitMax?: number;
  generalRateLimitMax?: number;
  prisma?: PrismaClient;
  schema?: string;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const activePrisma = options.prisma || defaultPrisma;
  const activeSchema =
    options.schema || (process.env.NODE_ENV === "test" ? "test" : "public");

  app.set("userRepo", new UserRepository(activePrisma));

  app.use(helmet());
  app.use(
    cors({
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json());

  // Health check endpoint (Issue #6)
  app.get("/api/health", async (_req: Request, res: Response) => {
    try {
      await activePrisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: "ok", db: "ok" });
    } catch {
      res.status(503).json({ status: "error", db: "down" });
    }
  });

  // General Postgres-backed rate limiting for all /api/v1 routes
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: options.generalRateLimitMax ?? 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: new PostgresRateLimitStore(activePrisma, activeSchema, "general"),
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again later.",
        },
      });
    },
  });

  // Postgres-backed rate limiting for auth routes (stricter limit)
  const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: options.rateLimitMax ?? 5,
    standardHeaders: true,
    legacyHeaders: false,
    store: new PostgresRateLimitStore(activePrisma, activeSchema, "auth"),
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many tries. Wait a minute and try again.",
        },
      });
    },
  });

  app.use("/api/v1", generalLimiter);
  app.use("/api/v1/auth", authLimiter);
  app.post("/api/v1/auth/signup", signupHandler);
  app.post("/api/v1/auth/login", loginHandler);
  app.post("/api/v1/auth/logout", logoutHandler);
  app.get("/api/v1/auth/me", requireAuth, meHandler);

  // Protected wallet route example demonstrating auth guard
  app.get("/api/v1/wallet", requireAuth, (req: Request, res: Response) => {
    res.status(200).json({
      message: "Wallet access granted",
      user: (req as AuthenticatedRequest).user,
    });
  });

  // Error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong. Try again.",
      },
    });
  });

  return app;
}
