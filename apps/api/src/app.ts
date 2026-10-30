import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { signupHandler } from "./controllers/auth.controller.js";
import { prisma } from "./db.js";

export function createApp(options: { rateLimitMax?: number } = {}) {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json());

  app.get("/api/health", async (_req: Request, res: Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: "ok", db: "ok" });
    } catch {
      res.status(503).json({ status: "error", db: "down" });
    }
  });

  // Rate limiting for auth routes
  const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: options.rateLimitMax ?? 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many tries. Wait a minute and try again.",
        },
      });
    },
  });

  app.use("/api/v1/auth", authLimiter);
  app.post("/api/v1/auth/signup", signupHandler);

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
