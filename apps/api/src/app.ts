import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { doubleCsrf } from "csrf-csrf";
import { PrismaClient } from "@prisma/client";
import {
  signupHandler,
  loginHandler,
  logoutHandler,
  meHandler,
} from "./controllers/auth.controller.js";
import { getRecommendationsHandler } from "./controllers/recommendation.controller.js";
import { searchStoresHandler } from "./controllers/store.controller.js";
import {
  getCatalogCardsHandler,
  getWalletCardsHandler,
  addWalletCardHandler,
  updateWalletCardHandler,
  deleteWalletCardHandler,
  updateWalletCardPaymentSettingsHandler,
  markWalletCardCyclePaidHandler,
  activateWalletCardQuarterHandler,
} from "./controllers/wallet.controller.js";
import {
  runReminderCronHandler,
  getNotificationsHandler,
  dismissNotificationHandler,
  dismissAllNotificationsHandler,
  getNotificationPreferencesHandler,
  updateNotificationPreferencesHandler,
} from "./controllers/notification.controller.js";
import {
  getPointsBalancesHandler,
  upsertPointsBalanceHandler,
} from "./controllers/points-balance.controller.js";
import {
  getPerksHandler,
  markPerkUsageHandler,
} from "./controllers/perk.controller.js";
import {
  getBonusOffersHandler,
  getBonusOfferByWalletCardHandler,
  addSpendEntryHandler,
  updateSpendEntryHandler,
  deleteSpendEntryHandler,
} from "./controllers/bonus.controller.js";
import { requireAuth } from "./middleware/auth.middleware.js";
import { PostgresRateLimitStore } from "./middleware/postgres-rate-limit.js";
import { UserRepository } from "./repositories/user.repository.js";
import { RecommendationRepository } from "./repositories/recommendation.repository.js";
import { WalletRepository } from "./repositories/wallet.repository.js";
import { CatalogRepository } from "./repositories/catalog.repository.js";
import { StoreRepository } from "./repositories/store.repository.js";
import { NotificationRepository } from "./repositories/notification.repository.js";
import { PointsBalanceRepository } from "./repositories/points-balance.repository.js";
import { PerkRepository } from "./repositories/perk.repository.js";
import { BonusRepository } from "./repositories/bonus.repository.js";
import { ReminderGeneratorRegistry } from "./domain/reminders.js";
import { prisma as defaultPrisma } from "./db.js";

export interface AppOptions {
  rateLimitMax?: number;
  generalRateLimitMax?: number;
  prisma?: PrismaClient;
  schema?: string;
  csrfSecret?: string;
  cronSecret?: string;
  reminderRegistry?: ReminderGeneratorRegistry;
  nowProvider?: () => Date;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const activePrisma = options.prisma || defaultPrisma;
  const activeSchema =
    options.schema || (process.env.NODE_ENV === "test" ? "test" : "public");

  app.set("userRepo", new UserRepository(activePrisma));
  app.set("recommendationRepo", new RecommendationRepository(activePrisma));
  app.set("walletRepo", new WalletRepository(activePrisma));
  app.set("catalogRepo", new CatalogRepository(activePrisma));
  app.set("storeRepo", new StoreRepository(activePrisma));
  app.set("notificationRepo", new NotificationRepository(activePrisma));
  app.set("pointsBalanceRepo", new PointsBalanceRepository(activePrisma));
  app.set("perkRepo", new PerkRepository(activePrisma));
  app.set("bonusRepo", new BonusRepository(activePrisma));
  if (options.cronSecret !== undefined) {
    app.set("cronSecret", options.cronSecret);
  }
  if (options.reminderRegistry) {
    app.set("reminderRegistry", options.reminderRegistry);
  }
  if (options.nowProvider) {
    app.set("nowProvider", options.nowProvider);
  }

  app.use(helmet());
  app.use(
    cors({
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json());

  // CSRF protection setup (double-submit cookie pattern)
  const csrfSecret =
    options.csrfSecret ||
    process.env.CSRF_SECRET ||
    "swipewise-default-csrf-secret-minimum-32-chars-long";

  const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => csrfSecret,
    getSessionIdentifier: () => "",
    cookieName: "x-csrf-token",
    cookieOptions: {
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    },
    size: 64,
    ignoredMethods: ["GET", "HEAD", "OPTIONS"],
    getCsrfTokenFromRequest: (req: Request) =>
      req.headers["x-csrf-token"] as string | undefined,
    errorConfig: {
      statusCode: 403,
      message: "Invalid or missing CSRF token.",
      code: "EBADCSRFTOKEN",
    },
  });

  // Health check endpoint (Issue #6)
  app.get("/api/health", async (_req: Request, res: Response) => {
    try {
      await activePrisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: "ok", db: "ok" });
    } catch {
      res.status(503).json({ status: "error", db: "down" });
    }
  });

  // Endpoint returning CSRF token for the frontend
  app.get("/api/v1/csrf-token", (req: Request, res: Response) => {
    const csrfToken = generateCsrfToken(req, res);
    res.status(200).json({ csrfToken, token: csrfToken });
  });

  // CSRF protection for all state-changing requests
  app.use(doubleCsrfProtection);

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
  app.post("/api/v1/auth/signup", authLimiter, signupHandler);
  app.post("/api/v1/auth/login", authLimiter, loginHandler);
  app.post("/api/v1/auth/logout", logoutHandler);
  app.get("/api/v1/auth/me", requireAuth, meHandler);

  // Best card by category recommendations (Issue #12)
  app.get("/api/v1/recommendations", requireAuth, getRecommendationsHandler);

  // Store search (Issue #13)
  app.get("/api/v1/stores/search", requireAuth, searchStoresHandler);
  app.get("/api/v1/stores", requireAuth, searchStoresHandler);

  // Catalog routes (Issue #11)
  app.get("/api/v1/catalog/cards", requireAuth, getCatalogCardsHandler);

  // Wallet routes (Issue #11 & #20)
  app.get("/api/v1/wallet/cards", requireAuth, getWalletCardsHandler);
  app.post("/api/v1/wallet/cards", requireAuth, addWalletCardHandler);
  app.patch("/api/v1/wallet/cards/:id", requireAuth, updateWalletCardHandler);
  app.delete("/api/v1/wallet/cards/:id", requireAuth, deleteWalletCardHandler);
  app.put(
    "/api/v1/wallet/cards/:id/payment-settings",
    requireAuth,
    updateWalletCardPaymentSettingsHandler,
  );
  app.patch(
    "/api/v1/wallet/cards/:id/payment-settings",
    requireAuth,
    updateWalletCardPaymentSettingsHandler,
  );
  app.post(
    "/api/v1/wallet/cards/:id/paid-cycles",
    requireAuth,
    markWalletCardCyclePaidHandler,
  );
  app.post(
    "/api/v1/wallet/cards/:id/quarter-activations",
    requireAuth,
    activateWalletCardQuarterHandler,
  );
  app.put(
    "/api/v1/wallet/cards/:id/quarter-activations",
    requireAuth,
    activateWalletCardQuarterHandler,
  );

  // Replaced placeholder /api/v1/wallet route
  app.get("/api/v1/wallet", requireAuth, getWalletCardsHandler);

  // Perks routes (Issue #21)
  app.get("/api/v1/perks", requireAuth, getPerksHandler);
  app.get("/api/v1/wallet/perks", requireAuth, getPerksHandler);
  app.post(
    "/api/v1/wallet/cards/:walletCardId/perks/:perkId/usage",
    requireAuth,
    markPerkUsageHandler,
  );
  app.put(
    "/api/v1/wallet/cards/:walletCardId/perks/:perkId/usage",
    requireAuth,
    markPerkUsageHandler,
  );
  app.post("/api/v1/perks/:perkId/use", requireAuth, markPerkUsageHandler);

  // Daily reminder cron job (Issue #19) — skips login & CSRF, requires Bearer CRON_SECRET
  app.get("/api/v1/cron/reminders", runReminderCronHandler);

  // Notifications & reminder preferences routes (Issue #19)
  app.get("/api/v1/notifications", requireAuth, getNotificationsHandler);
  app.post(
    "/api/v1/notifications/dismiss-all",
    requireAuth,
    dismissAllNotificationsHandler,
  );
  app.post(
    "/api/v1/notifications/:id/dismiss",
    requireAuth,
    dismissNotificationHandler,
  );
  app.patch(
    "/api/v1/notifications/:id/dismiss",
    requireAuth,
    dismissNotificationHandler,
  );
  app.delete(
    "/api/v1/notifications/:id",
    requireAuth,
    dismissNotificationHandler,
  );
  app.get(
    "/api/v1/notification-preferences",
    requireAuth,
    getNotificationPreferencesHandler,
  );
  app.patch(
    "/api/v1/notification-preferences",
    requireAuth,
    updateNotificationPreferencesHandler,
  );
  app.put(
    "/api/v1/notification-preferences",
    requireAuth,
    updateNotificationPreferencesHandler,
  );

  // Points balances routes (Issue #24)
  app.get("/api/v1/points-balances", requireAuth, getPointsBalancesHandler);
  app.put(
    "/api/v1/points-balances/:programId",
    requireAuth,
    upsertPointsBalanceHandler,
  );

  // Bonus offers & spend entries routes (Issue #22)
  app.get("/api/v1/bonus-offers", requireAuth, getBonusOffersHandler);
  app.get("/api/v1/bonus-tracker", requireAuth, getBonusOffersHandler);
  app.get(
    "/api/v1/wallet/cards/:id/bonus-offer",
    requireAuth,
    getBonusOfferByWalletCardHandler,
  );
  app.get(
    "/api/v1/wallet/cards/:id/bonus",
    requireAuth,
    getBonusOfferByWalletCardHandler,
  );
  app.post(
    "/api/v1/wallet/cards/:id/spend-entries",
    requireAuth,
    addSpendEntryHandler,
  );
  app.post(
    "/api/v1/wallet/cards/:id/spending-entries",
    requireAuth,
    addSpendEntryHandler,
  );
  app.patch(
    "/api/v1/wallet/cards/:walletCardId/spend-entries/:id",
    requireAuth,
    updateSpendEntryHandler,
  );
  app.patch(
    "/api/v1/wallet/cards/:walletCardId/spending-entries/:id",
    requireAuth,
    updateSpendEntryHandler,
  );
  app.patch("/api/v1/spend-entries/:id", requireAuth, updateSpendEntryHandler);
  app.put("/api/v1/spend-entries/:id", requireAuth, updateSpendEntryHandler);
  app.delete(
    "/api/v1/wallet/cards/:walletCardId/spend-entries/:id",
    requireAuth,
    deleteSpendEntryHandler,
  );
  app.delete(
    "/api/v1/wallet/cards/:walletCardId/spending-entries/:id",
    requireAuth,
    deleteSpendEntryHandler,
  );
  app.delete("/api/v1/spend-entries/:id", requireAuth, deleteSpendEntryHandler);

  // Error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (
      err &&
      typeof err === "object" &&
      (("code" in err && err.code === "EBADCSRFTOKEN") ||
        ("status" in err && (err as { status: number }).status === 403) ||
        ("statusCode" in err &&
          (err as { statusCode: number }).statusCode === 403))
    ) {
      res.status(403).json({
        error: {
          code: "EBADCSRFTOKEN",
          message: "Invalid or missing CSRF token.",
        },
      });
      return;
    }
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
