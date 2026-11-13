import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import request from "supertest";
import argon2 from "argon2";
import { SignJWT } from "jose";
import type { Express } from "express";
import {
  addWalletCardRequestSchema,
  createActivateQuarterRequestSchema,
  createSpendEntryRequestSchema,
  loginRequestSchema,
  markCyclePaidRequestSchema,
  notificationItemSchema,
  recommendationsQuerySchema,
  signupRequestSchema,
  storeSearchQuerySchema,
  updateNotificationPreferencesRequestSchema,
  updateSpendEntryRequestSchema,
  updateWalletCardRequestSchema,
  upsertPointsBalanceRequestSchema,
} from "@swipewise/shared";
import { createApp } from "../app.js";
import { prisma } from "../db.js";
import { getJwtSecret } from "../middleware/auth.middleware.js";
import { getCsrfTokenAndCookie } from "./test-helpers.js";

const hasTestDatabase = Boolean(
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
);

export function assertTestDatabaseAvailableInCi(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const isCi = Boolean(env.CI && env.CI !== "false" && env.CI !== "0");
  const hasDb = Boolean(env.DATABASE_URL_TEST || env.DATABASE_URL);
  if (isCi && !hasDb) {
    throw new Error(
      "CI is set, but neither DATABASE_URL_TEST nor DATABASE_URL is configured. Security DB integration tests must never be skipped in CI.",
    );
  }
}

// Fail immediately if CI is set without a configured test database.
assertTestDatabaseAvailableInCi(process.env);

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RouteSecuritySpec {
  method: HttpMethod;
  path: string;
  auth: "requireAuth" | "public" | "cronSecret";
  csrf: boolean;
  ownershipCheck:
    | "cross-user-id-404"
    | "user-scoped-list"
    | "user-scoped-mutation"
    | "shared-catalog-or-store"
    | "admin-only"
    | "none";
}

/**
 * Complete security matrix of every /api/v1 route registered in createApp().
 * The route coverage guard inspects the Express router stack and fails if any
 * /api/v1 endpoint is added without being registered here.
 */
export const SECURITY_ROUTE_MATRIX: readonly RouteSecuritySpec[] = [
  // Public / CSRF / Auth session endpoints
  {
    method: "GET",
    path: "/api/v1/csrf-token",
    auth: "public",
    csrf: false,
    ownershipCheck: "none",
  },
  {
    method: "POST",
    path: "/api/v1/auth/signup",
    auth: "public",
    csrf: true,
    ownershipCheck: "none",
  },
  {
    method: "POST",
    path: "/api/v1/auth/login",
    auth: "public",
    csrf: true,
    ownershipCheck: "none",
  },
  {
    method: "POST",
    path: "/api/v1/auth/logout",
    auth: "public",
    csrf: true,
    ownershipCheck: "none",
  },
  {
    method: "GET",
    path: "/api/v1/auth/me",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "user-scoped-list",
  },

  // Recommendations, stores, catalog
  {
    method: "GET",
    path: "/api/v1/recommendations",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "user-scoped-list",
  },
  {
    method: "GET",
    path: "/api/v1/stores/search",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "shared-catalog-or-store",
  },
  {
    method: "GET",
    path: "/api/v1/stores",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "shared-catalog-or-store",
  },
  {
    method: "GET",
    path: "/api/v1/catalog/cards",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "shared-catalog-or-store",
  },

  // Wallet cards & settings
  {
    method: "GET",
    path: "/api/v1/wallet/cards",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "user-scoped-list",
  },
  {
    method: "GET",
    path: "/api/v1/wallet",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "user-scoped-list",
  },
  {
    method: "POST",
    path: "/api/v1/wallet/cards",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "user-scoped-mutation",
  },
  {
    method: "PATCH",
    path: "/api/v1/wallet/cards/:id",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "DELETE",
    path: "/api/v1/wallet/cards/:id",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "PUT",
    path: "/api/v1/wallet/cards/:id/payment-settings",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "PATCH",
    path: "/api/v1/wallet/cards/:id/payment-settings",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "POST",
    path: "/api/v1/wallet/cards/:id/paid-cycles",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "POST",
    path: "/api/v1/wallet/cards/:id/quarter-activations",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "PUT",
    path: "/api/v1/wallet/cards/:id/quarter-activations",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },

  // Perks
  {
    method: "GET",
    path: "/api/v1/perks",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "user-scoped-list",
  },
  {
    method: "GET",
    path: "/api/v1/wallet/perks",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "user-scoped-list",
  },
  {
    method: "POST",
    path: "/api/v1/wallet/cards/:walletCardId/perks/:perkId/usage",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "PUT",
    path: "/api/v1/wallet/cards/:walletCardId/perks/:perkId/usage",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "POST",
    path: "/api/v1/perks/:perkId/use",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },

  // Cron
  {
    method: "GET",
    path: "/api/v1/cron/reminders",
    auth: "cronSecret",
    csrf: false,
    ownershipCheck: "none",
  },

  // Notifications & preferences
  {
    method: "GET",
    path: "/api/v1/notifications",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "user-scoped-list",
  },
  {
    method: "POST",
    path: "/api/v1/notifications/dismiss-all",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "user-scoped-mutation",
  },
  {
    method: "POST",
    path: "/api/v1/notifications/:id/dismiss",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "PATCH",
    path: "/api/v1/notifications/:id/dismiss",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "DELETE",
    path: "/api/v1/notifications/:id",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "GET",
    path: "/api/v1/notification-preferences",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "user-scoped-list",
  },
  {
    method: "PATCH",
    path: "/api/v1/notification-preferences",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "user-scoped-mutation",
  },
  {
    method: "PUT",
    path: "/api/v1/notification-preferences",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "user-scoped-mutation",
  },

  // Points balances
  {
    method: "GET",
    path: "/api/v1/points-balances",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "user-scoped-list",
  },
  {
    method: "PUT",
    path: "/api/v1/points-balances/:programId",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },

  // Bonus offers & spend entries (#22)
  {
    method: "GET",
    path: "/api/v1/bonus-offers",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "user-scoped-list",
  },
  {
    method: "GET",
    path: "/api/v1/bonus-tracker",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "user-scoped-list",
  },
  {
    method: "GET",
    path: "/api/v1/wallet/cards/:id/bonus-offer",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "GET",
    path: "/api/v1/wallet/cards/:id/bonus",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "POST",
    path: "/api/v1/wallet/cards/:id/spend-entries",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "POST",
    path: "/api/v1/wallet/cards/:id/spending-entries",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "PATCH",
    path: "/api/v1/wallet/cards/:walletCardId/spend-entries/:id",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "PATCH",
    path: "/api/v1/wallet/cards/:walletCardId/spending-entries/:id",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "PATCH",
    path: "/api/v1/spend-entries/:id",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "PUT",
    path: "/api/v1/spend-entries/:id",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "DELETE",
    path: "/api/v1/wallet/cards/:walletCardId/spend-entries/:id",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "DELETE",
    path: "/api/v1/wallet/cards/:walletCardId/spending-entries/:id",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  {
    method: "DELETE",
    path: "/api/v1/spend-entries/:id",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "cross-user-id-404",
  },
  // Admin routes (Issue #25)
  {
    method: "GET",
    path: "/api/v1/admin/cards",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "admin-only",
  },
  {
    method: "POST",
    path: "/api/v1/admin/cards",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "admin-only",
  },
  {
    method: "PATCH",
    path: "/api/v1/admin/cards/:id",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "admin-only",
  },
  {
    method: "POST",
    path: "/api/v1/admin/cards/:id/retire",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "admin-only",
  },
  {
    method: "GET",
    path: "/api/v1/admin/stores",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "admin-only",
  },
  {
    method: "POST",
    path: "/api/v1/admin/stores",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "admin-only",
  },
  {
    method: "PATCH",
    path: "/api/v1/admin/stores/:id",
    auth: "requireAuth",
    csrf: true,
    ownershipCheck: "admin-only",
  },
  {
    method: "GET",
    path: "/api/v1/admin/audit-logs",
    auth: "requireAuth",
    csrf: false,
    ownershipCheck: "admin-only",
  },
] as const;

/**
 * Complete inventory of every string input field in packages/shared Zod request schemas:
 * - Free-text fields use `noCardNumberRefinement` and are tested against Luhn-valid numbers in DB + HTTP tests.
 * - Format-constrained fields (UUID, YYYY-MM-DD, YYYY-MM, YYYY-Q[1-4], enum, email, numeric string) reject Luhn card numbers by format/range.
 */
export const SHARED_STRING_INPUT_FIELDS_INVENTORY = [
  {
    schema: "signupRequestSchema",
    field: "name",
    classification: "free-text (noCardNumberRefinement)",
    endpoint: "POST /api/v1/auth/signup",
    coveredByCardNumberEndpointTest: true,
  },
  {
    schema: "signupRequestSchema",
    field: "email",
    classification: "email format (z.string().email())",
    endpoint: "POST /api/v1/auth/signup",
    coveredByCardNumberEndpointTest: false,
    reason:
      "Constrained by email format (@ + domain); raw card numbers fail email validation with 400.",
  },
  {
    schema: "signupRequestSchema",
    field: "password / confirmPassword",
    classification:
      "authentication secret (hashed with argon2id, never stored/returned)",
    endpoint: "POST /api/v1/auth/signup",
    coveredByCardNumberEndpointTest: false,
    reason:
      "Password credential hashed via argon2id; never stored in plaintext or echoed.",
  },
  {
    schema: "loginRequestSchema",
    field: "email / password",
    classification: "email format + authentication secret",
    endpoint: "POST /api/v1/auth/login",
    coveredByCardNumberEndpointTest: false,
    reason:
      "Email requires valid email format; password is verified against argon2id hash and never stored.",
  },
  {
    schema: "addWalletCardRequestSchema",
    field: "cardId",
    classification: "UUID format (z.string().uuid())",
    endpoint: "POST /api/v1/wallet/cards",
    coveredByCardNumberEndpointTest: true,
    reason:
      "Strictly validated as 36-char hex UUID; rejects Luhn numbers with 400.",
  },
  {
    schema: "addWalletCardRequestSchema",
    field: "nickname",
    classification: "free-text (noCardNumberRefinement)",
    endpoint: "POST /api/v1/wallet/cards",
    coveredByCardNumberEndpointTest: true,
  },
  {
    schema: "addWalletCardRequestSchema",
    field: "openedDate",
    classification: "date format YYYY-MM-DD",
    endpoint: "POST /api/v1/wallet/cards",
    coveredByCardNumberEndpointTest: true,
    reason:
      "Strict 10-char YYYY-MM-DD regex rejects 13-19 digit card numbers with 400.",
  },
  {
    schema: "updateWalletCardRequestSchema",
    field: "nickname",
    classification: "free-text (noCardNumberRefinement)",
    endpoint: "PATCH /api/v1/wallet/cards/:id",
    coveredByCardNumberEndpointTest: true,
  },
  {
    schema: "markCyclePaidRequestSchema",
    field: "cycleYearMonth",
    classification: "cycle format YYYY-MM",
    endpoint: "POST /api/v1/wallet/cards/:id/paid-cycles",
    coveredByCardNumberEndpointTest: true,
    reason:
      "Strict 7-char YYYY-MM regex rejects 13-19 digit card numbers with 400.",
  },
  {
    schema: "activateQuarterRequestSchema / createActivateQuarterRequestSchema",
    field: "quarter",
    classification: "quarter format YYYY-Q[1-4]",
    endpoint: "POST|PUT /api/v1/wallet/cards/:id/quarter-activations",
    coveredByCardNumberEndpointTest: true,
    reason:
      "Strict 7-char YYYY-Q[1-4] regex rejects 13-19 digit card numbers with 400.",
  },
  {
    schema: "storeSearchQuerySchema",
    field: "q",
    classification: "free-text (noCardNumberRefinement)",
    endpoint: "GET /api/v1/stores/search & GET /api/v1/stores",
    coveredByCardNumberEndpointTest: true,
  },
  {
    schema: "recommendationsQuerySchema",
    field: "category",
    classification: "enum (GROCERIES | DINING | GAS | TRAVEL)",
    endpoint: "GET /api/v1/recommendations",
    coveredByCardNumberEndpointTest: true,
    reason: "Strict 4-value category enum rejects card numbers with 400.",
  },
  {
    schema: "recommendationsQuerySchema",
    field: "amountCents",
    classification: "integer string bounded 1..100_000_000",
    endpoint: "GET /api/v1/recommendations",
    coveredByCardNumberEndpointTest: true,
    reason:
      "Max 100,000,000 (9 digits); 13-19 digit card numbers exceed max and fail with 400.",
  },
  {
    schema: "upsertPointsBalanceRequestSchema",
    field: "expiryDate",
    classification: "calendar date YYYY-MM-DD",
    endpoint: "PUT /api/v1/points-balances/:programId",
    coveredByCardNumberEndpointTest: true,
    reason:
      "Strict 10-char YYYY-MM-DD regex rejects 13-19 digit card numbers with 400.",
  },
  {
    schema: "updateNotificationPreferencesRequestSchema",
    field: "type",
    classification:
      "enum (PAYMENT_DUE | PERK_ENDING | ROTATING_CATEGORY | POINTS_EXPIRY)",
    endpoint: "PATCH|PUT /api/v1/notification-preferences",
    coveredByCardNumberEndpointTest: true,
    reason: "Strict 4-value ReminderType enum rejects card numbers with 400.",
  },
  {
    schema: "notificationItemSchema",
    field: "title / body",
    classification: "free-text domain schema (noCardNumberRefinement)",
    endpoint: "GET /api/v1/notifications",
    coveredByCardNumberEndpointTest: true,
  },
  {
    schema: "createSpendEntryRequestSchema",
    field: "note",
    classification: "free-text (noCardNumberRefinement)",
    endpoint:
      "POST /api/v1/wallet/cards/:id/spend-entries & POST /api/v1/wallet/cards/:id/spending-entries",
    coveredByCardNumberEndpointTest: true,
  },
  {
    schema: "createSpendEntryRequestSchema",
    field: "date",
    classification: "date format YYYY-MM-DD",
    endpoint:
      "POST /api/v1/wallet/cards/:id/spend-entries & POST /api/v1/wallet/cards/:id/spending-entries",
    coveredByCardNumberEndpointTest: true,
    reason:
      "Strict 10-char YYYY-MM-DD regex rejects 13-19 digit card numbers with 400.",
  },
  {
    schema: "updateSpendEntryRequestSchema",
    field: "note",
    classification: "free-text (noCardNumberRefinement)",
    endpoint:
      "PATCH /api/v1/wallet/cards/:walletCardId/spend-entries/:id, PATCH /api/v1/wallet/cards/:walletCardId/spending-entries/:id, PATCH|PUT /api/v1/spend-entries/:id",
    coveredByCardNumberEndpointTest: true,
  },
  {
    schema: "updateSpendEntryRequestSchema",
    field: "date",
    classification: "date format YYYY-MM-DD",
    endpoint:
      "PATCH /api/v1/wallet/cards/:walletCardId/spend-entries/:id, PATCH /api/v1/wallet/cards/:walletCardId/spending-entries/:id, PATCH|PUT /api/v1/spend-entries/:id",
    coveredByCardNumberEndpointTest: true,
    reason:
      "Strict 10-char YYYY-MM-DD regex rejects 13-19 digit card numbers with 400.",
  },
] as const;

interface RouterLayer {
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
  };
  handle?: {
    stack?: RouterLayer[];
  };
}

function extractApiV1Routes(app: Express): string[] {
  const router =
    (
      app as unknown as {
        router?: { stack?: RouterLayer[] };
        _router?: { stack?: RouterLayer[] };
      }
    ).router ??
    (
      app as unknown as {
        _router?: { stack?: RouterLayer[] };
      }
    )._router;

  const stack = router?.stack ?? [];
  const discovered = new Set<string>();

  function walk(layers: RouterLayer[]) {
    for (const layer of layers) {
      if (layer.route?.path && layer.route.methods) {
        const routePath = layer.route.path;
        if (routePath.startsWith("/api/v1")) {
          for (const [method, enabled] of Object.entries(layer.route.methods)) {
            if (enabled) {
              discovered.add(`${method.toUpperCase()} ${routePath}`);
            }
          }
        }
      }
      if (layer.handle?.stack) {
        walk(layer.handle.stack);
      }
    }
  }

  walk(stack);
  return Array.from(discovered).sort();
}

async function signUserAuthCookie(
  userId: string,
  email: string,
): Promise<string> {
  const token = await new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
  return `auth_token=${token}`;
}

const LUHN_CARD_PAYLOADS = [
  {
    label: "contiguous 16-digit Visa",
    input: "4111111111111111",
    rawDigits: "4111111111111111",
  },
  {
    label: "space-separated 16-digit Visa",
    input: "4111 1111 1111 1111",
    rawDigits: "4111111111111111",
  },
  {
    label: "dash-separated 16-digit Visa",
    input: "4111-1111-1111-1111",
    rawDigits: "4111111111111111",
  },
  {
    label: "card number embedded in text",
    input: "Card 4111 1111 1111 1111 Primary",
    rawDigits: "4111111111111111",
  },
] as const;

describe("Security Suite — Route Coverage Guard, CI Guard & Shared Schema String Audit (#27)", () => {
  it("fails if CI is set without a configured test database URL", () => {
    expect(() =>
      assertTestDatabaseAvailableInCi({
        NODE_ENV: "test",
        CI: "true",
      }),
    ).toThrow(/Security DB integration tests must never be skipped in CI/);

    expect(() =>
      assertTestDatabaseAvailableInCi({
        NODE_ENV: "test",
        CI: "true",
        DATABASE_URL_TEST:
          "postgresql://postgres:postgres@localhost:5432/swipewise_test?schema=test",
      }),
    ).not.toThrow();
  });

  it("covers every registered /api/v1 route on the Express app in SECURITY_ROUTE_MATRIX", () => {
    const app = createApp();
    const actualRoutes = extractApiV1Routes(app);
    const expectedRoutes = SECURITY_ROUTE_MATRIX.map(
      (r) => `${r.method} ${r.path}`,
    ).sort();

    const missingFromSuite = actualRoutes.filter(
      (r) => !expectedRoutes.includes(r),
    );
    const staleInSuite = expectedRoutes.filter(
      (r) => !actualRoutes.includes(r),
    );

    expect(missingFromSuite).toEqual([]);
    expect(staleInSuite).toEqual([]);
    expect(actualRoutes).toEqual(expectedRoutes);
  });

  it("rejects Luhn-valid card numbers across all free-text and constrained string fields in packages/shared schemas", () => {
    expect(SHARED_STRING_INPUT_FIELDS_INVENTORY.length).toBeGreaterThanOrEqual(
      20,
    );

    for (const payload of LUHN_CARD_PAYLOADS) {
      // 1. Free-text schemas with noCardNumberRefinement
      const signupRes = signupRequestSchema.safeParse({
        name: payload.input,
        email: "valid@example.com",
        password: "Password123",
        confirmPassword: "Password123",
      });
      expect(signupRes.success).toBe(false);

      const addCardNicknameRes = addWalletCardRequestSchema.safeParse({
        cardId: "11111111-1111-4111-8111-111111111111",
        nickname: payload.input,
      });
      expect(addCardNicknameRes.success).toBe(false);

      const updateCardNicknameRes = updateWalletCardRequestSchema.safeParse({
        nickname: payload.input,
      });
      expect(updateCardNicknameRes.success).toBe(false);

      const storeQueryRes = storeSearchQuerySchema.safeParse({
        q: payload.input,
      });
      expect(storeQueryRes.success).toBe(false);

      const notifRes = notificationItemSchema.safeParse({
        id: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222",
        type: "PAYMENT_DUE",
        title: payload.input,
        body: payload.input,
        dueDate: "2026-11-15",
        dedupeKey: "key-1",
        dismissedAt: null,
        createdAt: "2026-11-10T00:00:00.000Z",
      });
      expect(notifRes.success).toBe(false);

      const createSpendNoteRes = createSpendEntryRequestSchema.safeParse({
        amountCents: 2500,
        date: "2026-11-01",
        note: payload.input,
      });
      expect(createSpendNoteRes.success).toBe(false);

      const updateSpendNoteRes = updateSpendEntryRequestSchema.safeParse({
        note: payload.input,
      });
      expect(updateSpendNoteRes.success).toBe(false);

      // 2. Constrained string schemas (UUID, dates, cycles, quarters, enums, bounded numeric strings, email)
      expect(
        loginRequestSchema.safeParse({
          email: payload.input,
          password: "Password123",
        }).success,
      ).toBe(false);

      expect(
        addWalletCardRequestSchema.safeParse({
          cardId: payload.input,
        }).success,
      ).toBe(false);

      expect(
        addWalletCardRequestSchema.safeParse({
          cardId: "11111111-1111-4111-8111-111111111111",
          openedDate: payload.input,
        }).success,
      ).toBe(false);

      expect(
        markCyclePaidRequestSchema.safeParse({
          cycleYearMonth: payload.input,
        }).success,
      ).toBe(false);

      expect(
        createActivateQuarterRequestSchema(["2026-Q4", "2027-Q1"]).safeParse({
          quarter: payload.input,
        }).success,
      ).toBe(false);

      expect(
        recommendationsQuerySchema.safeParse({
          category: payload.input,
          amountCents: "10000",
        }).success,
      ).toBe(false);

      expect(
        recommendationsQuerySchema.safeParse({
          category: "DINING",
          amountCents: payload.input,
        }).success,
      ).toBe(false);

      expect(
        upsertPointsBalanceRequestSchema.safeParse({
          pointsBalance: 1000,
          expiryDate: payload.input,
        }).success,
      ).toBe(false);

      expect(
        updateNotificationPreferencesRequestSchema.safeParse({
          type: payload.input,
          enabled: false,
        }).success,
      ).toBe(false);

      expect(
        createSpendEntryRequestSchema.safeParse({
          amountCents: 2500,
          date: payload.input,
        }).success,
      ).toBe(false);

      expect(
        updateSpendEntryRequestSchema.safeParse({
          date: payload.input,
        }).success,
      ).toBe(false);
    }
  });

  it("enforces 401 Logged-out, 403 CSRF, 401 Cron, and 400 Card-number + log-redaction across HTTP routes", async () => {
    const rateHits = new Map<string, { hits: number; resetTime: Date }>();
    const createdUsers: unknown[] = [];
    const createdCards: unknown[] = [];
    const createdSpendEntries: unknown[] = [];
    const updatedSpendEntries: unknown[] = [];

    const fakePrisma = {
      $executeRawUnsafe: async () => 0,
      $queryRawUnsafe: async (_sql: string, key: string, resetTime: Date) => {
        const entry = rateHits.get(key) ?? { hits: 0, resetTime };
        entry.hits += 1;
        rateHits.set(key, entry);
        return [{ total_hits: entry.hits, reset_time: entry.resetTime }];
      },
      user: {
        create: async (args: unknown) => {
          createdUsers.push(args);
          return args;
        },
      },
      walletCard: {
        create: async (args: unknown) => {
          createdCards.push(args);
          return args;
        },
        findFirst: async () => null,
      },
      spendEntry: {
        create: async (args: unknown) => {
          createdSpendEntries.push(args);
          return args;
        },
        update: async (args: unknown) => {
          updatedSpendEntries.push(args);
          return args;
        },
        findUnique: async () => null,
      },
    } as unknown as NonNullable<Parameters<typeof createApp>[0]>["prisma"];

    const localApp = createApp({
      prisma: fakePrisma,
      schema: "test",
      cronSecret: "local-cron-secret-27",
      nowProvider: () => new Date("2026-11-10T18:00:00.000Z"),
    });

    const sampleUuid = "11111111-1111-4111-8111-111111111111";
    const authCookie = await signUserAuthCookie(
      sampleUuid,
      "sec-user@example.com",
    );
    const csrf = await getCsrfTokenAndCookie(localApp);

    // 1. Logged out -> 401 on all 43 protected routes
    for (const route of SECURITY_ROUTE_MATRIX.filter(
      (r) => r.auth === "requireAuth",
    )) {
      rateHits.clear();
      const url = route.path
        .replace(":walletCardId", sampleUuid)
        .replace(":perkId", sampleUuid)
        .replace(":programId", sampleUuid)
        .replace(":id", sampleUuid);
      const method = route.method.toLowerCase() as
        | "get"
        | "post"
        | "put"
        | "patch"
        | "delete";
      let req = request(localApp)[method](url);
      if (route.csrf) {
        req = req
          .set("Cookie", csrf.cookie)
          .set("x-csrf-token", csrf.token)
          .send({});
      }
      const res = await req;
      expect(res.status, `Logged-out ${route.method} ${route.path}`).toBe(401);
      expect(res.body.error?.code).toBe("UNAUTHORIZED");
    }

    // 2. CSRF -> 403 on all 30 state-changing routes
    for (const route of SECURITY_ROUTE_MATRIX.filter((r) => r.csrf)) {
      rateHits.clear();
      const url = route.path
        .replace(":walletCardId", sampleUuid)
        .replace(":perkId", sampleUuid)
        .replace(":programId", sampleUuid)
        .replace(":id", sampleUuid);
      const method = route.method.toLowerCase() as
        | "post"
        | "put"
        | "patch"
        | "delete";
      const res = await request(localApp)
        [method](url)
        .set("Cookie", authCookie)
        .send({});
      expect(res.status, `Missing CSRF ${route.method} ${route.path}`).toBe(
        403,
      );
      expect(res.body.error?.code).toBe("EBADCSRFTOKEN");
    }

    // 3. Cron -> 401 without secret or with wrong secret
    rateHits.clear();
    expect((await request(localApp).get("/api/v1/cron/reminders")).status).toBe(
      401,
    );
    expect(
      (
        await request(localApp)
          .get("/api/v1/cron/reminders")
          .set("Authorization", "Bearer wrong")
      ).status,
    ).toBe(401);

    // 4. Card numbers -> 400, never stored, never echoed, never logged
    const capturedLogs: string[] = [];
    const spies = [
      vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => {
        capturedLogs.push(a.map(String).join(" "));
      }),
      vi.spyOn(console, "info").mockImplementation((...a: unknown[]) => {
        capturedLogs.push(a.map(String).join(" "));
      }),
      vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => {
        capturedLogs.push(a.map(String).join(" "));
      }),
      vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
        capturedLogs.push(a.map(String).join(" "));
      }),
    ];

    try {
      const cookiesWithCsrf = `${authCookie}; ${csrf.cookie}`;
      for (const payload of LUHN_CARD_PAYLOADS) {
        rateHits.clear();

        const requests = [
          request(localApp)
            .post("/api/v1/auth/signup")
            .set("Cookie", cookiesWithCsrf)
            .set("x-csrf-token", csrf.token)
            .send({
              name: payload.input,
              email: "sec@example.com",
              password: "Password123",
              confirmPassword: "Password123",
            }),
          request(localApp)
            .post("/api/v1/wallet/cards")
            .set("Cookie", cookiesWithCsrf)
            .set("x-csrf-token", csrf.token)
            .send({ cardId: sampleUuid, nickname: payload.input }),
          request(localApp)
            .patch(`/api/v1/wallet/cards/${sampleUuid}`)
            .set("Cookie", cookiesWithCsrf)
            .set("x-csrf-token", csrf.token)
            .send({ nickname: payload.input }),
          request(localApp)
            .get(`/api/v1/stores/search?q=${encodeURIComponent(payload.input)}`)
            .set("Cookie", authCookie),
          request(localApp)
            .get(`/api/v1/stores?q=${encodeURIComponent(payload.input)}`)
            .set("Cookie", authCookie),
          request(localApp)
            .get(`/api/v1/stores?query=${encodeURIComponent(payload.input)}`)
            .set("Cookie", authCookie),
          request(localApp)
            .post(`/api/v1/wallet/cards/${sampleUuid}/paid-cycles`)
            .set("Cookie", cookiesWithCsrf)
            .set("x-csrf-token", csrf.token)
            .send({ cycleYearMonth: payload.input }),
          request(localApp)
            .put(`/api/v1/points-balances/${sampleUuid}`)
            .set("Cookie", cookiesWithCsrf)
            .set("x-csrf-token", csrf.token)
            .send({ pointsBalance: 100, expiryDate: payload.input }),
          request(localApp)
            .get(
              `/api/v1/recommendations?category=DINING&amountCents=${encodeURIComponent(payload.input)}`,
            )
            .set("Cookie", authCookie),
          request(localApp)
            .patch("/api/v1/notification-preferences")
            .set("Cookie", cookiesWithCsrf)
            .set("x-csrf-token", csrf.token)
            .send({ type: payload.input, enabled: false }),
          request(localApp)
            .post(`/api/v1/wallet/cards/${sampleUuid}/spend-entries`)
            .set("Cookie", cookiesWithCsrf)
            .set("x-csrf-token", csrf.token)
            .send({
              amountCents: 2500,
              date: "2026-11-01",
              note: payload.input,
            }),
          request(localApp)
            .post(`/api/v1/wallet/cards/${sampleUuid}/spending-entries`)
            .set("Cookie", cookiesWithCsrf)
            .set("x-csrf-token", csrf.token)
            .send({
              amountCents: 2500,
              date: "2026-11-01",
              note: payload.input,
            }),
          request(localApp)
            .patch(
              `/api/v1/wallet/cards/${sampleUuid}/spend-entries/${sampleUuid}`,
            )
            .set("Cookie", cookiesWithCsrf)
            .set("x-csrf-token", csrf.token)
            .send({ note: payload.input }),
          request(localApp)
            .patch(
              `/api/v1/wallet/cards/${sampleUuid}/spending-entries/${sampleUuid}`,
            )
            .set("Cookie", cookiesWithCsrf)
            .set("x-csrf-token", csrf.token)
            .send({ note: payload.input }),
          request(localApp)
            .patch(`/api/v1/spend-entries/${sampleUuid}`)
            .set("Cookie", cookiesWithCsrf)
            .set("x-csrf-token", csrf.token)
            .send({ note: payload.input }),
          request(localApp)
            .put(`/api/v1/spend-entries/${sampleUuid}`)
            .set("Cookie", cookiesWithCsrf)
            .set("x-csrf-token", csrf.token)
            .send({
              amountCents: 2500,
              date: "2026-11-01",
              note: payload.input,
            }),
        ];

        for (const reqPromise of requests) {
          rateHits.clear();
          const res = await reqPromise;
          expect(res.status).toBe(400);
          const bodyStr = JSON.stringify(res.body);
          expect(bodyStr).not.toContain(payload.input);
          expect(bodyStr).not.toContain(payload.rawDigits);
        }
      }

      const logOutput = capturedLogs.join("\n");
      for (const payload of LUHN_CARD_PAYLOADS) {
        expect(logOutput).not.toContain(payload.input);
        expect(logOutput).not.toContain(payload.rawDigits);
      }
      expect(createdUsers).toHaveLength(0);
      expect(createdCards).toHaveLength(0);
      expect(createdSpendEntries).toHaveLength(0);
      expect(updatedSpendEntries).toHaveLength(0);
    } finally {
      for (const s of spies) s.mockRestore();
    }
  });

  it("enforces AC1 multi-tenant ownership (404 on cross-user mutations and zero User A ID leaks on list endpoints) across all controllers, services, and repositories", async () => {
    const USER_A_ID = "11111111-1111-4111-8111-111111111111";
    const USER_B_ID = "22222222-2222-4222-8222-222222222222";
    const WC_A_HARBOR_ID = "aaaaaaaa-1111-4111-8111-111111111111";
    const WC_A_ORBIT_ID = "aaaaaaaa-2222-4222-8222-222222222222";
    const WC_B_MINT_ID = "bbbbbbbb-1111-4111-8111-111111111111";
    const PROG_HARBOR_ID = "cccccccc-1111-4111-8111-111111111111";
    const PROG_MINT_ID = "cccccccc-2222-4222-8222-222222222222";
    const PERK_RIDE_ID = "dddddddd-1111-4111-8111-111111111111";
    const PERK_STREAM_ID = "dddddddd-2222-4222-8222-222222222222";
    const NOTIF_A_ID = "eeeeeeee-1111-4111-8111-111111111111";
    const NOTIF_B_ID = "eeeeeeee-2222-4222-8222-222222222222";
    const BAL_A_ID = "ffffffff-1111-4111-8111-111111111111";
    const BAL_B_ID = "ffffffff-2222-4222-8222-222222222222";
    const PU_A_ID = "99999999-1111-4111-8111-111111111111";
    const PU_B_ID = "99999999-2222-4222-8222-222222222222";
    const BONUS_OFFER_HARBOR_ID = "77777777-1111-4111-8111-111111111111";
    const BONUS_OFFER_MINT_ID = "77777777-2222-4222-8222-222222222222";
    const WC_BONUS_A_ID = "88888888-1111-4111-8111-111111111111";
    const WC_BONUS_B_ID = "88888888-2222-4222-8222-222222222222";
    const SPEND_A_ID = "66666666-1111-4111-8111-111111111111";
    const SPEND_B_ID = "66666666-2222-4222-8222-222222222222";

    const fixedDate = new Date("2026-11-10T18:00:00.000Z");

    const users = [
      {
        id: USER_A_ID,
        name: "User A",
        email: "user-a@example.com",
        passwordHash: "hash-a",
        timeZone: "America/Los_Angeles",
        createdAt: fixedDate,
        updatedAt: fixedDate,
      },
      {
        id: USER_B_ID,
        name: "User B",
        email: "user-b@example.com",
        passwordHash: "hash-b",
        timeZone: "America/Los_Angeles",
        createdAt: fixedDate,
        updatedAt: fixedDate,
      },
    ];

    const spendEntries = [
      {
        id: SPEND_A_ID,
        walletCardId: WC_A_HARBOR_ID,
        walletCardBonusOfferId: WC_BONUS_A_ID,
        amountCents: 50000,
        date: new Date("2025-02-01T00:00:00.000Z"),
        note: "User A initial spend",
        createdAt: fixedDate,
        updatedAt: fixedDate,
        walletCard: {
          id: WC_A_HARBOR_ID,
          userId: USER_A_ID,
        },
      },
      {
        id: SPEND_B_ID,
        walletCardId: WC_B_MINT_ID,
        walletCardBonusOfferId: WC_BONUS_B_ID,
        amountCents: 25000,
        date: new Date("2025-02-15T00:00:00.000Z"),
        note: "User B initial spend",
        createdAt: fixedDate,
        updatedAt: fixedDate,
        walletCard: {
          id: WC_B_MINT_ID,
          userId: USER_B_ID,
        },
      },
    ];

    const walletCards = [
      {
        id: WC_A_HARBOR_ID,
        userId: USER_A_ID,
        cardId: "card-harbor",
        nickname: "User A Harbor",
        openedDate: new Date("2025-01-15T00:00:00.000Z"),
        createdAt: fixedDate,
        updatedAt: fixedDate,
        user: { timeZone: "America/Los_Angeles" },
        paymentSetting: { dueDay: 15, isAutopay: false },
        paidCycles: [{ cycleYearMonth: "2026-10" }],
        quarterActivations: [],
        bonusOffer: {
          id: WC_BONUS_A_ID,
          walletCardId: WC_A_HARBOR_ID,
          spendRequirementCents: 400000,
          windowMonths: 3,
          bonusPoints: 60000,
          createdAt: fixedDate,
          updatedAt: fixedDate,
        },
        spendEntries: [spendEntries[0]!],
        card: {
          id: "card-harbor",
          name: "Harbor Travel Plus",
          issuer: "Demo Bank",
          artColor: "#2F74D0",
          isDemo: true,
          programId: PROG_HARBOR_ID,
          annualFeeCents: 9500,
          baseRateX100: 100,
          program: {
            id: PROG_HARBOR_ID,
            name: "Harbor Points",
            centsPer100Points: 125,
          },
          rewardRules: [{ category: "DINING", rateX100: 300, capCents: null }],
          rotatingCategories: [],
          bonusOffer: {
            id: BONUS_OFFER_HARBOR_ID,
            cardId: "card-harbor",
            spendRequirementCents: 400000,
            windowMonths: 3,
            bonusPoints: 60000,
          },
          perks: [
            {
              id: PERK_RIDE_ID,
              cardId: "card-harbor",
              name: "Ride credit",
              amountCents: 1500,
              period: "MONTHLY",
            },
          ],
        },
      },
      {
        id: WC_A_ORBIT_ID,
        userId: USER_A_ID,
        cardId: "card-orbit",
        nickname: "User A Orbit",
        openedDate: new Date("2025-03-01T00:00:00.000Z"),
        createdAt: fixedDate,
        updatedAt: fixedDate,
        user: { timeZone: "America/Los_Angeles" },
        paymentSetting: null,
        paidCycles: [],
        quarterActivations: [{ quarter: "2026-Q4" }],
        bonusOffer: null,
        spendEntries: [],
        card: {
          id: "card-orbit",
          name: "Orbit Quarterly",
          issuer: "Demo Bank",
          artColor: "#6C5CE7",
          isDemo: true,
          programId: PROG_HARBOR_ID,
          annualFeeCents: 0,
          baseRateX100: 100,
          program: {
            id: PROG_HARBOR_ID,
            name: "Harbor Points",
            centsPer100Points: 125,
          },
          rewardRules: [],
          rotatingCategories: [
            {
              quarter: "2026-Q4",
              category: "GAS",
              rateX100: 500,
              capCents: 150000,
            },
          ],
          bonusOffer: null,
          perks: [],
        },
      },
      {
        id: WC_B_MINT_ID,
        userId: USER_B_ID,
        cardId: "card-mint",
        nickname: "User B Mint",
        openedDate: new Date("2025-02-10T00:00:00.000Z"),
        createdAt: fixedDate,
        updatedAt: fixedDate,
        user: { timeZone: "America/Los_Angeles" },
        paymentSetting: { dueDay: 22, isAutopay: true },
        paidCycles: [{ cycleYearMonth: "2026-09" }],
        quarterActivations: [],
        bonusOffer: {
          id: WC_BONUS_B_ID,
          walletCardId: WC_B_MINT_ID,
          spendRequirementCents: 100000,
          windowMonths: 3,
          bonusPoints: 20000,
          createdAt: fixedDate,
          updatedAt: fixedDate,
        },
        spendEntries: [spendEntries[1]!],
        card: {
          id: "card-mint",
          name: "Mint Everyday",
          issuer: "Demo Bank",
          artColor: "#2F8C55",
          isDemo: true,
          programId: PROG_MINT_ID,
          annualFeeCents: 0,
          baseRateX100: 150,
          program: {
            id: PROG_MINT_ID,
            name: "Meadow Rewards",
            centsPer100Points: 100,
          },
          rewardRules: [
            { category: "GROCERIES", rateX100: 400, capCents: null },
          ],
          rotatingCategories: [],
          bonusOffer: {
            id: BONUS_OFFER_MINT_ID,
            cardId: "card-mint",
            spendRequirementCents: 100000,
            windowMonths: 3,
            bonusPoints: 20000,
          },
          perks: [
            {
              id: PERK_STREAM_ID,
              cardId: "card-mint",
              name: "Streaming credit",
              amountCents: 1000,
              period: "MONTHLY",
            },
          ],
        },
      },
    ];

    const notifications = [
      {
        id: NOTIF_A_ID,
        userId: USER_A_ID,
        type: "PAYMENT_DUE",
        title: "User A payment due soon",
        body: "User A Harbor payment is due on Nov 15.",
        dueDate: new Date("2026-11-15T00:00:00.000Z"),
        dedupeKey: "key-a",
        dismissedAt: null as Date | null,
        createdAt: fixedDate,
      },
      {
        id: NOTIF_B_ID,
        userId: USER_B_ID,
        type: "PERK_ENDING",
        title: "User B streaming credit ending",
        body: "User B Mint streaming credit resets soon.",
        dueDate: new Date("2026-11-30T00:00:00.000Z"),
        dedupeKey: "key-b",
        dismissedAt: null as Date | null,
        createdAt: fixedDate,
      },
    ];

    const preferences = [
      { userId: USER_A_ID, type: "PERK_ENDING", enabled: false },
      { userId: USER_B_ID, type: "PAYMENT_DUE", enabled: false },
    ];

    const balances = [
      {
        id: BAL_A_ID,
        userId: USER_A_ID,
        programId: PROG_HARBOR_ID,
        pointsBalance: 10000,
        expiryDate: new Date("2026-12-31T00:00:00.000Z"),
      },
      {
        id: BAL_B_ID,
        userId: USER_B_ID,
        programId: PROG_MINT_ID,
        pointsBalance: 5000,
        expiryDate: new Date("2026-12-15T00:00:00.000Z"),
      },
    ];

    const perkUsages = [
      {
        id: PU_A_ID,
        walletCardId: WC_A_HARBOR_ID,
        perkId: PERK_RIDE_ID,
        periodKey: "2026-11",
        usedCents: 400,
      },
      {
        id: PU_B_ID,
        walletCardId: WC_B_MINT_ID,
        perkId: PERK_STREAM_ID,
        periodKey: "2026-11",
        usedCents: 250,
      },
    ];

    const fakePrisma = {
      $executeRawUnsafe: async () => 0,
      $queryRawUnsafe: async () => [
        { total_hits: 1, reset_time: new Date(Date.now() + 60000) },
      ],
      user: {
        findUnique: async ({ where }: { where: { id?: string } }) =>
          users.find((u) => u.id === where.id) ?? null,
      },
      walletCard: {
        findMany: async ({ where }: { where: { userId: string } }) =>
          walletCards.filter((wc) => wc.userId === where.userId),
        findFirst: async ({
          where,
        }: {
          where: {
            id?: string;
            userId?: string;
            card?: { programId?: string };
          };
        }) =>
          walletCards.find(
            (wc) =>
              (where.id === undefined || wc.id === where.id) &&
              (where.userId === undefined || wc.userId === where.userId) &&
              (where.card?.programId === undefined ||
                wc.card.programId === where.card.programId),
          ) ?? null,
        findUnique: async ({ where }: { where: { id: string } }) =>
          walletCards.find((wc) => wc.id === where.id) ?? null,
      },
      spendEntry: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          spendEntries.find((se) => se.id === where.id) ?? null,
      },
      perkUsage: {
        findMany: async ({
          where,
        }: {
          where: { walletCardId?: { in: string[] } };
        }) =>
          perkUsages.filter((u) =>
            where.walletCardId?.in.includes(u.walletCardId),
          ),
      },
      notification: {
        findMany: async ({
          where,
        }: {
          where: { userId: string; dismissedAt: null };
        }) =>
          notifications.filter(
            (n) => n.userId === where.userId && n.dismissedAt === null,
          ),
        findFirst: async ({
          where,
        }: {
          where: { id: string; userId: string };
        }) =>
          notifications.find(
            (n) => n.id === where.id && n.userId === where.userId,
          ) ?? null,
        updateMany: async ({
          where,
          data,
        }: {
          where: { userId: string; dismissedAt: null };
          data: { dismissedAt: Date };
        }) => {
          let count = 0;
          for (const n of notifications) {
            if (n.userId === where.userId && n.dismissedAt === null) {
              n.dismissedAt = data.dismissedAt;
              count += 1;
            }
          }
          return { count };
        },
      },
      notificationPreference: {
        findMany: async ({ where }: { where: { userId: string } }) =>
          preferences.filter((p) => p.userId === where.userId),
        upsert: async ({
          where,
          update,
          create,
        }: {
          where: { userId_type: { userId: string; type: string } };
          update: { enabled: boolean };
          create: { userId: string; type: string; enabled: boolean };
        }) => {
          const found = preferences.find(
            (p) =>
              p.userId === where.userId_type.userId &&
              p.type === where.userId_type.type,
          );
          if (found) {
            found.enabled = update.enabled;
            return found;
          }
          preferences.push(create);
          return create;
        },
      },
      programBalance: {
        findMany: async ({
          where,
        }: {
          where: { userId: string; programId?: { in: string[] } };
        }) =>
          balances.filter(
            (b) =>
              b.userId === where.userId &&
              (!where.programId || where.programId.in.includes(b.programId)),
          ),
      },
    } as unknown as NonNullable<Parameters<typeof createApp>[0]>["prisma"];

    const localApp = createApp({
      prisma: fakePrisma,
      schema: "test",
      cronSecret: "local-cron-secret-27",
      nowProvider: () => fixedDate,
    });

    const authCookieB = await signUserAuthCookie(
      USER_B_ID,
      "user-b@example.com",
    );
    const csrfB = await getCsrfTokenAndCookie(localApp);
    const cookiesB = `${authCookieB}; ${csrfB.cookie}`;

    const userAIds = [
      USER_A_ID,
      "user-a@example.com",
      WC_A_HARBOR_ID,
      WC_A_ORBIT_ID,
      PROG_HARBOR_ID,
      PERK_RIDE_ID,
      NOTIF_A_ID,
      BAL_A_ID,
      PU_A_ID,
      BONUS_OFFER_HARBOR_ID,
      WC_BONUS_A_ID,
      SPEND_A_ID,
      "User A initial spend",
    ];

    for (const listPath of [
      "/api/v1/auth/me",
      "/api/v1/wallet/cards",
      "/api/v1/wallet",
      "/api/v1/recommendations?category=DINING&amountCents=10000",
      "/api/v1/perks",
      "/api/v1/wallet/perks",
      "/api/v1/notifications",
      "/api/v1/notification-preferences",
      "/api/v1/points-balances",
      "/api/v1/bonus-offers",
      "/api/v1/bonus-tracker",
    ]) {
      const res = await request(localApp)
        .get(listPath)
        .set("Cookie", authCookieB);
      expect(res.status, `GET ${listPath}`).toBe(200);
      const serialized = JSON.stringify(res.body);
      for (const id of userAIds) {
        expect(serialized, `GET ${listPath} leaked ${id}`).not.toContain(id);
      }
    }

    const crossMutations = [
      request(localApp)
        .get(`/api/v1/wallet/cards/${WC_A_HARBOR_ID}/bonus`)
        .set("Cookie", authCookieB),
      request(localApp)
        .get(`/api/v1/wallet/cards/${WC_A_HARBOR_ID}/bonus-offer`)
        .set("Cookie", authCookieB),
      request(localApp)
        .post(`/api/v1/wallet/cards/${WC_A_HARBOR_ID}/spend-entries`)
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token)
        .send({
          amountCents: 12345,
          date: "2025-02-20",
          note: "Injected by B",
        }),
      request(localApp)
        .post(`/api/v1/wallet/cards/${WC_A_HARBOR_ID}/spending-entries`)
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token)
        .send({
          amountCents: 12345,
          date: "2025-02-20",
          note: "Injected by B",
        }),
      request(localApp)
        .patch(
          `/api/v1/wallet/cards/${WC_A_HARBOR_ID}/spend-entries/${SPEND_A_ID}`,
        )
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token)
        .send({ amountCents: 99999, note: "Hijacked by B" }),
      request(localApp)
        .patch(
          `/api/v1/wallet/cards/${WC_A_HARBOR_ID}/spending-entries/${SPEND_A_ID}`,
        )
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token)
        .send({ amountCents: 99999, note: "Hijacked by B" }),
      request(localApp)
        .patch(
          `/api/v1/wallet/cards/${WC_B_MINT_ID}/spend-entries/${SPEND_A_ID}`,
        )
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token)
        .send({ amountCents: 99999, note: "Hijacked via B card URL" }),
      request(localApp)
        .patch(
          `/api/v1/wallet/cards/${WC_B_MINT_ID}/spending-entries/${SPEND_A_ID}`,
        )
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token)
        .send({ amountCents: 99999, note: "Hijacked via B card URL" }),
      request(localApp)
        .patch(`/api/v1/spend-entries/${SPEND_A_ID}`)
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token)
        .send({ amountCents: 99999, note: "Hijacked top-level PATCH" }),
      request(localApp)
        .put(`/api/v1/spend-entries/${SPEND_A_ID}`)
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token)
        .send({
          amountCents: 99999,
          date: "2025-03-01",
          note: "Hijacked top-level PUT",
        }),
      request(localApp)
        .delete(
          `/api/v1/wallet/cards/${WC_A_HARBOR_ID}/spend-entries/${SPEND_A_ID}`,
        )
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token),
      request(localApp)
        .delete(
          `/api/v1/wallet/cards/${WC_A_HARBOR_ID}/spending-entries/${SPEND_A_ID}`,
        )
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token),
      request(localApp)
        .delete(
          `/api/v1/wallet/cards/${WC_B_MINT_ID}/spend-entries/${SPEND_A_ID}`,
        )
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token),
      request(localApp)
        .delete(
          `/api/v1/wallet/cards/${WC_B_MINT_ID}/spending-entries/${SPEND_A_ID}`,
        )
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token),
      request(localApp)
        .delete(`/api/v1/spend-entries/${SPEND_A_ID}`)
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token),
      request(localApp)
        .patch(`/api/v1/wallet/cards/${WC_A_HARBOR_ID}`)
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token)
        .send({ nickname: "Hacked" }),
      request(localApp)
        .delete(`/api/v1/wallet/cards/${WC_A_HARBOR_ID}`)
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token),
      request(localApp)
        .put(`/api/v1/wallet/cards/${WC_A_HARBOR_ID}/payment-settings`)
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token)
        .send({ dueDay: 1, isAutopay: true }),
      request(localApp)
        .patch(`/api/v1/wallet/cards/${WC_A_HARBOR_ID}/payment-settings`)
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token)
        .send({ dueDay: 1, isAutopay: true }),
      request(localApp)
        .post(`/api/v1/wallet/cards/${WC_A_HARBOR_ID}/paid-cycles`)
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token)
        .send({ cycleYearMonth: "2026-11" }),
      request(localApp)
        .post(`/api/v1/wallet/cards/${WC_A_ORBIT_ID}/quarter-activations`)
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token)
        .send({ quarter: "2027-Q1" }),
      request(localApp)
        .put(`/api/v1/wallet/cards/${WC_A_ORBIT_ID}/quarter-activations`)
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token)
        .send({ quarter: "2027-Q1" }),
      request(localApp)
        .post(
          `/api/v1/wallet/cards/${WC_A_HARBOR_ID}/perks/${PERK_RIDE_ID}/usage`,
        )
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token)
        .send({ usedCents: 1000 }),
      request(localApp)
        .put(
          `/api/v1/wallet/cards/${WC_A_HARBOR_ID}/perks/${PERK_RIDE_ID}/usage`,
        )
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token)
        .send({ isFull: true }),
      request(localApp)
        .post(`/api/v1/perks/${PERK_RIDE_ID}/use`)
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token)
        .send({ walletCardId: WC_A_HARBOR_ID, usedCents: 1000 }),
      request(localApp)
        .post(`/api/v1/notifications/${NOTIF_A_ID}/dismiss`)
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token),
      request(localApp)
        .patch(`/api/v1/notifications/${NOTIF_A_ID}/dismiss`)
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token),
      request(localApp)
        .delete(`/api/v1/notifications/${NOTIF_A_ID}`)
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token),
      request(localApp)
        .put(`/api/v1/points-balances/${PROG_HARBOR_ID}`)
        .set("Cookie", cookiesB)
        .set("x-csrf-token", csrfB.token)
        .send({ pointsBalance: 99999, expiryDate: "2027-06-30" }),
    ];

    for (const reqPromise of crossMutations) {
      const res = await reqPromise;
      expect(res.status).toBe(404);
    }

    // Verify User A's records are completely untouched
    expect(walletCards[0]?.nickname).toBe("User A Harbor");
    expect(walletCards[0]?.paymentSetting?.dueDay).toBe(15);
    expect(perkUsages[0]?.usedCents).toBe(400);
    expect(balances[0]?.pointsBalance).toBe(10000);
    expect(notifications[0]?.dismissedAt).toBeNull();
    expect(preferences[0]?.enabled).toBe(false);
    expect(spendEntries).toHaveLength(2);
    expect(spendEntries[0]?.amountCents).toBe(50000);
    expect(spendEntries[0]?.note).toBe("User A initial spend");
  });
});

describe.skipIf(!hasTestDatabase)(
  "Security Integration Suite — Multi-Tenant Isolation, Auth, CSRF, Cron & Card-Number Guard (US-01, US-02 / Issue #27)",
  () => {
    const TEST_CRON_SECRET = "security-suite-cron-secret-27";
    const fixedNow = new Date("2026-11-10T18:00:00.000Z"); // 2026-11-10 in America/Los_Angeles (2026-Q4)

    // Use production rate-limiter settings (do not loosen rateLimitMax or generalRateLimitMax)
    const app = createApp({
      prisma,
      schema: "test",
      cronSecret: TEST_CRON_SECRET,
      nowProvider: () => fixedNow,
    });

    let sharedPasswordHash = "";

    interface SeededUserFixture {
      id: string;
      email: string;
      name: string;
      authCookie: string;
      cookiesWithCsrf: string;
      csrfToken: string;
      walletCardHarborId: string;
      walletCardOrbitId: string;
      paymentSettingId: string;
      paidCycleId: string;
      quarterActivationId: string;
      perkUsageId: string;
      walletCardBonusOfferId: string;
      spendEntryId: string;
      programId: string;
      programBalanceId: string;
      notificationId: string;
      notificationPreferenceId: string;
    }

    let harborCardId = "";
    let orbitCardId = "";
    let ridePerkId = "";
    let loungePerkId = "";
    let harborBonusOfferId = "";
    let harborProgramId = "";
    let meadowProgramId = "";

    let userA!: SeededUserFixture;
    let userB!: SeededUserFixture;

    beforeAll(async () => {
      sharedPasswordHash = await argon2.hash("Password123", {
        type: argon2.argon2id,
      });
    });

    beforeEach(async () => {
      await prisma.notification.deleteMany();
      await prisma.notificationPreference.deleteMany();
      await prisma.spendEntry.deleteMany();
      await prisma.walletCardBonusOffer.deleteMany();
      await prisma.bonusOffer.deleteMany();
      await prisma.perkUsage.deleteMany();
      await prisma.perk.deleteMany();
      await prisma.programBalance.deleteMany();
      await prisma.walletCardQuarterActivation.deleteMany();
      await prisma.walletCardPaidCycle.deleteMany();
      await prisma.walletCardPaymentSetting.deleteMany();
      await prisma.walletCard.deleteMany();
      await prisma.rotatingCategory.deleteMany();
      await prisma.rewardRule.deleteMany();
      await prisma.card.deleteMany();
      await prisma.rewardsProgram.deleteMany();
      await prisma.storeAlias.deleteMany();
      await prisma.store.deleteMany();
      await prisma.user.deleteMany();
      await prisma.rateLimit.deleteMany();

      // Seed distinct rewards programs for User A and User B
      const harborProgram = await prisma.rewardsProgram.create({
        data: {
          name: "Harbor Points",
          centsPer100Points: 125,
        },
      });
      harborProgramId = harborProgram.id;

      const meadowProgram = await prisma.rewardsProgram.create({
        data: {
          name: "Meadow Rewards",
          centsPer100Points: 100,
        },
      });
      meadowProgramId = meadowProgram.id;

      // Seed catalog cards with perks, bonus offers, and rotating categories (made-up demo names only)
      const harborCard = await prisma.card.create({
        data: {
          name: "Harbor Travel Plus",
          issuer: "Demo Bank",
          artColor: "#2F74D0",
          isDemo: true,
          programId: harborProgram.id,
          annualFeeCents: 9500,
          baseRateX100: 100,
          rewardRules: {
            create: [{ category: "DINING", rateX100: 300, capCents: null }],
          },
          perks: {
            create: [
              {
                name: "Ride credit",
                amountCents: 1500,
                period: "MONTHLY",
              },
            ],
          },
          bonusOffer: {
            create: {
              spendRequirementCents: 400000,
              windowMonths: 3,
              bonusPoints: 60000,
            },
          },
        },
        include: { perks: true, bonusOffer: true },
      });
      harborCardId = harborCard.id;
      ridePerkId = harborCard.perks[0]!.id;
      harborBonusOfferId = harborCard.bonusOffer!.id;

      const orbitCard = await prisma.card.create({
        data: {
          name: "Orbit Quarterly",
          issuer: "Demo Bank",
          artColor: "#6C5CE7",
          isDemo: true,
          programId: harborProgram.id,
          annualFeeCents: 0,
          baseRateX100: 100,
          rotatingCategories: {
            create: [
              {
                quarter: "2026-Q4",
                category: "GAS",
                rateX100: 500,
                capCents: 150000,
              },
              {
                quarter: "2027-Q1",
                category: "GROCERIES",
                rateX100: 500,
                capCents: 150000,
              },
            ],
          },
        },
      });
      orbitCardId = orbitCard.id;

      const meadowCard = await prisma.card.create({
        data: {
          name: "Mint Everyday",
          issuer: "Demo Bank",
          artColor: "#2F8C55",
          isDemo: true,
          programId: meadowProgram.id,
          annualFeeCents: 0,
          baseRateX100: 150,
          rewardRules: {
            create: [{ category: "GROCERIES", rateX100: 400, capCents: null }],
          },
          perks: {
            create: [
              {
                name: "Streaming credit",
                amountCents: 1000,
                period: "MONTHLY",
              },
            ],
          },
          bonusOffer: {
            create: {
              spendRequirementCents: 100000,
              windowMonths: 3,
              bonusPoints: 20000,
            },
          },
        },
        include: { perks: true, bonusOffer: true },
      });
      loungePerkId = meadowCard.perks[0]!.id;

      await prisma.store.create({
        data: {
          name: "Safeway",
          category: "GROCERIES",
          aliases: {
            create: [{ alias: "safeway.com" }],
          },
        },
      });

      // Create User A directly in DB + signed auth_token cookie to avoid hitting auth rate limit
      const dbUserA = await prisma.user.create({
        data: {
          name: "User A",
          email: "user-a-sec@example.com",
          passwordHash: sharedPasswordHash,
          timeZone: "America/Los_Angeles",
        },
      });
      const authCookieA = await signUserAuthCookie(dbUserA.id, dbUserA.email);
      const csrfA = await getCsrfTokenAndCookie(app);

      const wcAHarbor = await prisma.walletCard.create({
        data: {
          userId: dbUserA.id,
          cardId: harborCard.id,
          nickname: "User A Harbor",
          openedDate: new Date("2025-01-15T00:00:00.000Z"),
        },
      });
      const wcAOrbit = await prisma.walletCard.create({
        data: {
          userId: dbUserA.id,
          cardId: orbitCardId,
          nickname: "User A Orbit",
          openedDate: new Date("2025-03-01T00:00:00.000Z"),
        },
      });
      const psA = await prisma.walletCardPaymentSetting.create({
        data: {
          walletCardId: wcAHarbor.id,
          dueDay: 15,
          isAutopay: false,
        },
      });
      const pcA = await prisma.walletCardPaidCycle.create({
        data: {
          walletCardId: wcAHarbor.id,
          cycleYearMonth: "2026-10",
          paidAt: new Date("2026-10-14T12:00:00.000Z"),
        },
      });
      const qaA = await prisma.walletCardQuarterActivation.create({
        data: {
          walletCardId: wcAOrbit.id,
          quarter: "2026-Q4",
          activatedAt: new Date("2026-10-01T12:00:00.000Z"),
        },
      });
      const puA = await prisma.perkUsage.create({
        data: {
          walletCardId: wcAHarbor.id,
          perkId: ridePerkId,
          periodKey: "2026-11",
          usedCents: 400,
        },
      });
      const wcBoA = await prisma.walletCardBonusOffer.create({
        data: {
          walletCardId: wcAHarbor.id,
          spendRequirementCents: 400000,
          windowMonths: 3,
          bonusPoints: 60000,
        },
      });
      const seA = await prisma.spendEntry.create({
        data: {
          walletCardId: wcAHarbor.id,
          walletCardBonusOfferId: wcBoA.id,
          amountCents: 50000,
          date: new Date("2025-02-01T00:00:00.000Z"),
          note: "User A initial spend",
        },
      });
      const pbA = await prisma.programBalance.create({
        data: {
          userId: dbUserA.id,
          programId: harborProgram.id,
          pointsBalance: 10000,
          expiryDate: new Date("2026-12-31T00:00:00.000Z"),
        },
      });
      const notifA = await prisma.notification.create({
        data: {
          userId: dbUserA.id,
          type: "PAYMENT_DUE",
          title: "User A payment due soon",
          body: "User A Harbor payment is due on Nov 15.",
          dueDate: new Date("2026-11-15T00:00:00.000Z"),
          dedupeKey: `PAYMENT_DUE:${wcAHarbor.id}:2026-11:5d`,
        },
      });
      const prefA = await prisma.notificationPreference.create({
        data: {
          userId: dbUserA.id,
          type: "PERK_ENDING",
          enabled: false,
        },
      });

      userA = {
        id: dbUserA.id,
        email: dbUserA.email,
        name: dbUserA.name,
        authCookie: authCookieA,
        cookiesWithCsrf: `${authCookieA}; ${csrfA.cookie}`,
        csrfToken: csrfA.token,
        walletCardHarborId: wcAHarbor.id,
        walletCardOrbitId: wcAOrbit.id,
        paymentSettingId: psA.id,
        paidCycleId: pcA.id,
        quarterActivationId: qaA.id,
        perkUsageId: puA.id,
        walletCardBonusOfferId: wcBoA.id,
        spendEntryId: seA.id,
        programId: harborProgram.id,
        programBalanceId: pbA.id,
        notificationId: notifA.id,
        notificationPreferenceId: prefA.id,
      };

      // Create User B directly in DB + signed auth_token cookie with separate cards & records
      const dbUserB = await prisma.user.create({
        data: {
          name: "User B",
          email: "user-b-sec@example.com",
          passwordHash: sharedPasswordHash,
          timeZone: "America/Los_Angeles",
        },
      });
      const authCookieB = await signUserAuthCookie(dbUserB.id, dbUserB.email);
      const csrfB = await getCsrfTokenAndCookie(app);

      const wcBMeadow = await prisma.walletCard.create({
        data: {
          userId: dbUserB.id,
          cardId: meadowCard.id,
          nickname: "User B Mint",
          openedDate: new Date("2025-02-10T00:00:00.000Z"),
        },
      });
      const wcBOrbit = await prisma.walletCard.create({
        data: {
          userId: dbUserB.id,
          cardId: orbitCardId,
          nickname: "User B Orbit",
          openedDate: new Date("2025-04-01T00:00:00.000Z"),
        },
      });
      const psB = await prisma.walletCardPaymentSetting.create({
        data: {
          walletCardId: wcBMeadow.id,
          dueDay: 22,
          isAutopay: true,
        },
      });
      const pcB = await prisma.walletCardPaidCycle.create({
        data: {
          walletCardId: wcBMeadow.id,
          cycleYearMonth: "2026-09",
          paidAt: new Date("2026-09-20T12:00:00.000Z"),
        },
      });
      const qaB = await prisma.walletCardQuarterActivation.create({
        data: {
          walletCardId: wcBOrbit.id,
          quarter: "2026-Q4",
          activatedAt: new Date("2026-10-02T12:00:00.000Z"),
        },
      });
      const puB = await prisma.perkUsage.create({
        data: {
          walletCardId: wcBMeadow.id,
          perkId: loungePerkId,
          periodKey: "2026-11",
          usedCents: 250,
        },
      });
      const wcBoB = await prisma.walletCardBonusOffer.create({
        data: {
          walletCardId: wcBMeadow.id,
          spendRequirementCents: 100000,
          windowMonths: 3,
          bonusPoints: 20000,
        },
      });
      const seB = await prisma.spendEntry.create({
        data: {
          walletCardId: wcBMeadow.id,
          walletCardBonusOfferId: wcBoB.id,
          amountCents: 25000,
          date: new Date("2025-02-15T00:00:00.000Z"),
          note: "User B initial spend",
        },
      });
      const pbB = await prisma.programBalance.create({
        data: {
          userId: dbUserB.id,
          programId: meadowProgram.id,
          pointsBalance: 5000,
          expiryDate: new Date("2026-12-15T00:00:00.000Z"),
        },
      });
      const notifB = await prisma.notification.create({
        data: {
          userId: dbUserB.id,
          type: "PERK_ENDING",
          title: "User B streaming credit ending",
          body: "User B Mint streaming credit resets soon.",
          dueDate: new Date("2026-11-30T00:00:00.000Z"),
          dedupeKey: `PERK_ENDING:${wcBMeadow.id}:${loungePerkId}:2026-11`,
        },
      });
      const prefB = await prisma.notificationPreference.create({
        data: {
          userId: dbUserB.id,
          type: "PAYMENT_DUE",
          enabled: false,
        },
      });

      userB = {
        id: dbUserB.id,
        email: dbUserB.email,
        name: dbUserB.name,
        authCookie: authCookieB,
        cookiesWithCsrf: `${authCookieB}; ${csrfB.cookie}`,
        csrfToken: csrfB.token,
        walletCardHarborId: wcBMeadow.id,
        walletCardOrbitId: wcBOrbit.id,
        paymentSettingId: psB.id,
        paidCycleId: pcB.id,
        quarterActivationId: qaB.id,
        perkUsageId: puB.id,
        walletCardBonusOfferId: wcBoB.id,
        spendEntryId: seB.id,
        programId: meadowProgram.id,
        programBalanceId: pbB.id,
        notificationId: notifB.id,
        notificationPreferenceId: prefB.id,
      };

      await prisma.rateLimit.deleteMany();
    });

    afterAll(async () => {
      await prisma.notification.deleteMany();
      await prisma.notificationPreference.deleteMany();
      await prisma.spendEntry.deleteMany();
      await prisma.walletCardBonusOffer.deleteMany();
      await prisma.bonusOffer.deleteMany();
      await prisma.perkUsage.deleteMany();
      await prisma.perk.deleteMany();
      await prisma.programBalance.deleteMany();
      await prisma.walletCardQuarterActivation.deleteMany();
      await prisma.walletCardPaidCycle.deleteMany();
      await prisma.walletCardPaymentSetting.deleteMany();
      await prisma.walletCard.deleteMany();
      await prisma.rotatingCategory.deleteMany();
      await prisma.rewardRule.deleteMany();
      await prisma.card.deleteMany();
      await prisma.rewardsProgram.deleteMany();
      await prisma.storeAlias.deleteMany();
      await prisma.store.deleteMany();
      await prisma.user.deleteMany();
      await prisma.rateLimit.deleteMany();
    });

    function materializeRoutePath(
      templatePath: string,
      target: SeededUserFixture,
    ): string {
      if (
        templatePath.includes("/spend-entries/:id") ||
        templatePath.includes("/spending-entries/:id")
      ) {
        return templatePath
          .replace(":walletCardId", target.walletCardHarborId)
          .replace(":id", target.spendEntryId);
      }
      return templatePath
        .replace(":walletCardId", target.walletCardHarborId)
        .replace(":perkId", ridePerkId)
        .replace(":programId", target.programId)
        .replace(":id", target.walletCardHarborId);
    }

    it("Logged out: every protected /api/v1 endpoint returns 401 UNAUTHORIZED", async () => {
      const protectedRoutes = SECURITY_ROUTE_MATRIX.filter(
        (r) => r.auth === "requireAuth",
      );
      expect(protectedRoutes.length).toBe(51);

      const csrf = await getCsrfTokenAndCookie(app);

      for (const route of protectedRoutes) {
        await prisma.rateLimit.deleteMany();
        const url = materializeRoutePath(route.path, userA);
        const method = route.method.toLowerCase() as
          | "get"
          | "post"
          | "put"
          | "patch"
          | "delete";

        let req = request(app)[method](url);
        if (route.csrf) {
          req = req
            .set("Cookie", csrf.cookie)
            .set("x-csrf-token", csrf.token)
            .send({});
        }

        const res = await req;
        expect(
          res.status,
          `Expected 401 for logged-out ${route.method} ${route.path}, got ${res.status}`,
        ).toBe(401);
        expect(res.body.error?.code).toBe("UNAUTHORIZED");
      }
    });

    it("CSRF: every state-changing /api/v1 endpoint rejects requests without a valid CSRF token with 403 EBADCSRFTOKEN", async () => {
      const csrfRoutes = SECURITY_ROUTE_MATRIX.filter((r) => r.csrf);
      expect(csrfRoutes.length).toBe(35);

      for (const route of csrfRoutes) {
        await prisma.rateLimit.deleteMany();
        const url = materializeRoutePath(route.path, userA);
        const method = route.method.toLowerCase() as
          | "post"
          | "put"
          | "patch"
          | "delete";

        // Send User A's valid auth_token cookie, but omit CSRF cookie/header
        const res = await request(app)
          [method](url)
          .set("Cookie", userA.authCookie)
          .send({});

        expect(
          res.status,
          `Expected 403 EBADCSRFTOKEN for ${route.method} ${route.path}, got ${res.status}`,
        ).toBe(403);
        expect(res.body.error?.code).toBe("EBADCSRFTOKEN");
      }
    });

    it("Admin routes: non-admin logged-in user gets 403 FORBIDDEN on every admin route", async () => {
      const adminRoutes = SECURITY_ROUTE_MATRIX.filter(
        (r) => r.ownershipCheck === "admin-only",
      );
      expect(adminRoutes.length).toBe(8);

      for (const route of adminRoutes) {
        await prisma.rateLimit.deleteMany();
        const url = materializeRoutePath(route.path, userA);
        const method = route.method.toLowerCase() as
          | "get"
          | "post"
          | "put"
          | "patch"
          | "delete";

        let req = request(app)
          [method](url)
          .set("Cookie", userA.cookiesWithCsrf);
        if (route.csrf) {
          req = req.set("x-csrf-token", userA.csrfToken).send({});
        }

        const res = await req;
        expect(
          res.status,
          `Expected 403 for non-admin on ${route.method} ${route.path}, got ${res.status}`,
        ).toBe(403);
        expect(res.body.error?.code).toBe("FORBIDDEN");
      }
    });

    it("Cron: GET /api/v1/cron/reminders returns 401 without secret or with wrong secret", async () => {
      const missingRes = await request(app).get("/api/v1/cron/reminders");
      expect(missingRes.status).toBe(401);
      expect(missingRes.body.error?.code).toBe("UNAUTHORIZED");

      const wrongRes = await request(app)
        .get("/api/v1/cron/reminders")
        .set("Authorization", "Bearer wrong-cron-secret");
      expect(wrongRes.status).toBe(401);
      expect(wrongRes.body.error?.code).toBe("UNAUTHORIZED");
    });

    it("AC1 (Ownership — List & Read endpoints): User B never receives any of User A's IDs or records", async () => {
      const userAForbiddenIds = [
        userA.id,
        userA.email,
        userA.walletCardHarborId,
        userA.walletCardOrbitId,
        userA.paymentSettingId,
        userA.paidCycleId,
        userA.quarterActivationId,
        userA.perkUsageId,
        userA.walletCardBonusOfferId,
        userA.spendEntryId,
        harborBonusOfferId,
        userA.programBalanceId,
        userA.notificationId,
        userA.notificationPreferenceId,
      ];

      function assertContainsNoUserAIds(endpointLabel: string, body: unknown) {
        const serialized = JSON.stringify(body);
        for (const forbiddenId of userAForbiddenIds) {
          expect(
            serialized,
            `Response from ${endpointLabel} leaked User A identifier ${forbiddenId}`,
          ).not.toContain(forbiddenId);
        }
        expect(serialized).not.toContain("User A Harbor");
        expect(serialized).not.toContain("User A Orbit");
        expect(serialized).not.toContain("User A payment due soon");
        expect(serialized).not.toContain("User A initial spend");
      }

      // 1. GET /api/v1/auth/me
      const meRes = await request(app)
        .get("/api/v1/auth/me")
        .set("Cookie", userB.authCookie);
      expect(meRes.status).toBe(200);
      expect(meRes.body.user.id).toBe(userB.id);
      assertContainsNoUserAIds("GET /api/v1/auth/me", meRes.body);

      // 2. GET /api/v1/wallet/cards & GET /api/v1/wallet
      for (const path of ["/api/v1/wallet/cards", "/api/v1/wallet"]) {
        const res = await request(app)
          .get(path)
          .set("Cookie", userB.authCookie);
        expect(res.status).toBe(200);
        expect(res.body.walletCards).toHaveLength(2);
        assertContainsNoUserAIds(`GET ${path}`, res.body);
      }

      // 3. GET /api/v1/recommendations
      const recRes = await request(app)
        .get("/api/v1/recommendations?category=DINING&amountCents=10000")
        .set("Cookie", userB.authCookie);
      expect(recRes.status).toBe(200);
      assertContainsNoUserAIds("GET /api/v1/recommendations", recRes.body);

      // 4. GET /api/v1/perks & GET /api/v1/wallet/perks
      for (const path of ["/api/v1/perks", "/api/v1/wallet/perks"]) {
        const res = await request(app)
          .get(path)
          .set("Cookie", userB.authCookie);
        expect(res.status).toBe(200);
        assertContainsNoUserAIds(`GET ${path}`, res.body);
      }

      // 5. GET /api/v1/notifications
      const notifRes = await request(app)
        .get("/api/v1/notifications")
        .set("Cookie", userB.authCookie);
      expect(notifRes.status).toBe(200);
      expect(notifRes.body.notifications).toHaveLength(1);
      expect(notifRes.body.notifications[0].id).toBe(userB.notificationId);
      assertContainsNoUserAIds("GET /api/v1/notifications", notifRes.body);

      // 6. GET /api/v1/notification-preferences
      const prefRes = await request(app)
        .get("/api/v1/notification-preferences")
        .set("Cookie", userB.authCookie);
      expect(prefRes.status).toBe(200);
      assertContainsNoUserAIds(
        "GET /api/v1/notification-preferences",
        prefRes.body,
      );
      const perkPref = prefRes.body.preferences.find(
        (p: { type: string }) => p.type === "PERK_ENDING",
      );
      // User A disabled PERK_ENDING, but User B has it enabled by default
      expect(perkPref?.enabled).toBe(true);

      // 7. GET /api/v1/points-balances
      // Remove User B's Orbit card first so Harbor Points is exclusively in User A's wallet
      await prisma.walletCard.delete({
        where: { id: userB.walletCardOrbitId },
      });
      const ptsRes = await request(app)
        .get("/api/v1/points-balances")
        .set("Cookie", userB.authCookie);
      expect(ptsRes.status).toBe(200);
      assertContainsNoUserAIds("GET /api/v1/points-balances", ptsRes.body);
      expect(
        ptsRes.body.programs.map((p: { programId: string }) => p.programId),
      ).toEqual([meadowProgramId]);

      // 8. GET /api/v1/bonus-offers & GET /api/v1/bonus-tracker
      for (const path of ["/api/v1/bonus-offers", "/api/v1/bonus-tracker"]) {
        const res = await request(app)
          .get(path)
          .set("Cookie", userB.authCookie);
        expect(res.status).toBe(200);
        expect(res.body.bonuses).toHaveLength(1);
        expect(res.body.bonuses[0].walletCardId).toBe(userB.walletCardHarborId);
        expect(res.body.bonuses[0].bonusOfferId).toBe(
          userB.walletCardBonusOfferId,
        );
        expect(res.body.bonuses[0].spendEntries).toHaveLength(1);
        expect(res.body.bonuses[0].spendEntries[0].id).toBe(userB.spendEntryId);
        assertContainsNoUserAIds(`GET ${path}`, res.body);
      }

      // 9. GET /api/v1/wallet/cards/:id/bonus & GET /api/v1/wallet/cards/:id/bonus-offer with User A's walletCardId -> 404
      for (const path of [
        `/api/v1/wallet/cards/${userA.walletCardHarborId}/bonus`,
        `/api/v1/wallet/cards/${userA.walletCardHarborId}/bonus-offer`,
      ]) {
        const res = await request(app)
          .get(path)
          .set("Cookie", userB.authCookie);
        expect(res.status).toBe(404);
        assertContainsNoUserAIds(`GET ${path}`, res.body);
      }
    });

    it("AC1 (Ownership — Mutations): User B using User A's IDs always gets 404 and leaves User A's data completely unchanged", async () => {
      // Remove User B's Orbit card so Harbor Points program belongs exclusively to User A's wallet
      await prisma.walletCard.delete({
        where: { id: userB.walletCardOrbitId },
      });

      const crossUserAttempts: Array<{
        label: string;
        exec: () => Promise<request.Response>;
      }> = [
        {
          label: "GET /api/v1/wallet/cards/:id/bonus",
          exec: () =>
            request(app)
              .get(`/api/v1/wallet/cards/${userA.walletCardHarborId}/bonus`)
              .set("Cookie", userB.authCookie),
        },
        {
          label: "GET /api/v1/wallet/cards/:id/bonus-offer",
          exec: () =>
            request(app)
              .get(
                `/api/v1/wallet/cards/${userA.walletCardHarborId}/bonus-offer`,
              )
              .set("Cookie", userB.authCookie),
        },
        {
          label: "POST /api/v1/wallet/cards/:id/spend-entries",
          exec: () =>
            request(app)
              .post(
                `/api/v1/wallet/cards/${userA.walletCardHarborId}/spend-entries`,
              )
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken)
              .send({
                amountCents: 12345,
                date: "2025-02-20",
                note: "Injected by B",
              }),
        },
        {
          label: "POST /api/v1/wallet/cards/:id/spending-entries",
          exec: () =>
            request(app)
              .post(
                `/api/v1/wallet/cards/${userA.walletCardHarborId}/spending-entries`,
              )
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken)
              .send({
                amountCents: 12345,
                date: "2025-02-20",
                note: "Injected by B",
              }),
        },
        {
          label:
            "PATCH /api/v1/wallet/cards/:walletCardId/spend-entries/:id (User A card + User A entry)",
          exec: () =>
            request(app)
              .patch(
                `/api/v1/wallet/cards/${userA.walletCardHarborId}/spend-entries/${userA.spendEntryId}`,
              )
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken)
              .send({ amountCents: 99999, note: "Hijacked by B" }),
        },
        {
          label:
            "PATCH /api/v1/wallet/cards/:walletCardId/spending-entries/:id (User A card + User A entry)",
          exec: () =>
            request(app)
              .patch(
                `/api/v1/wallet/cards/${userA.walletCardHarborId}/spending-entries/${userA.spendEntryId}`,
              )
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken)
              .send({ amountCents: 99999, note: "Hijacked by B" }),
        },
        {
          label:
            "PATCH /api/v1/wallet/cards/:walletCardId/spend-entries/:id (User B card + User A entry)",
          exec: () =>
            request(app)
              .patch(
                `/api/v1/wallet/cards/${userB.walletCardHarborId}/spend-entries/${userA.spendEntryId}`,
              )
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken)
              .send({ amountCents: 99999, note: "Hijacked via B card URL" }),
        },
        {
          label:
            "PATCH /api/v1/wallet/cards/:walletCardId/spending-entries/:id (User B card + User A entry)",
          exec: () =>
            request(app)
              .patch(
                `/api/v1/wallet/cards/${userB.walletCardHarborId}/spending-entries/${userA.spendEntryId}`,
              )
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken)
              .send({ amountCents: 99999, note: "Hijacked via B card URL" }),
        },
        {
          label: "PATCH /api/v1/spend-entries/:id (top-level)",
          exec: () =>
            request(app)
              .patch(`/api/v1/spend-entries/${userA.spendEntryId}`)
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken)
              .send({ amountCents: 99999, note: "Hijacked top-level PATCH" }),
        },
        {
          label: "PUT /api/v1/spend-entries/:id (top-level)",
          exec: () =>
            request(app)
              .put(`/api/v1/spend-entries/${userA.spendEntryId}`)
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken)
              .send({
                amountCents: 99999,
                date: "2025-03-01",
                note: "Hijacked top-level PUT",
              }),
        },
        {
          label:
            "DELETE /api/v1/wallet/cards/:walletCardId/spend-entries/:id (User A card + User A entry)",
          exec: () =>
            request(app)
              .delete(
                `/api/v1/wallet/cards/${userA.walletCardHarborId}/spend-entries/${userA.spendEntryId}`,
              )
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken),
        },
        {
          label:
            "DELETE /api/v1/wallet/cards/:walletCardId/spending-entries/:id (User A card + User A entry)",
          exec: () =>
            request(app)
              .delete(
                `/api/v1/wallet/cards/${userA.walletCardHarborId}/spending-entries/${userA.spendEntryId}`,
              )
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken),
        },
        {
          label:
            "DELETE /api/v1/wallet/cards/:walletCardId/spend-entries/:id (User B card + User A entry)",
          exec: () =>
            request(app)
              .delete(
                `/api/v1/wallet/cards/${userB.walletCardHarborId}/spend-entries/${userA.spendEntryId}`,
              )
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken),
        },
        {
          label:
            "DELETE /api/v1/wallet/cards/:walletCardId/spending-entries/:id (User B card + User A entry)",
          exec: () =>
            request(app)
              .delete(
                `/api/v1/wallet/cards/${userB.walletCardHarborId}/spending-entries/${userA.spendEntryId}`,
              )
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken),
        },
        {
          label: "DELETE /api/v1/spend-entries/:id (top-level)",
          exec: () =>
            request(app)
              .delete(`/api/v1/spend-entries/${userA.spendEntryId}`)
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken),
        },
        {
          label: "PATCH /api/v1/wallet/cards/:id",
          exec: () =>
            request(app)
              .patch(`/api/v1/wallet/cards/${userA.walletCardHarborId}`)
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken)
              .send({ nickname: "Hijacked by B" }),
        },
        {
          label: "DELETE /api/v1/wallet/cards/:id",
          exec: () =>
            request(app)
              .delete(`/api/v1/wallet/cards/${userA.walletCardHarborId}`)
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken),
        },
        {
          label: "PUT /api/v1/wallet/cards/:id/payment-settings",
          exec: () =>
            request(app)
              .put(
                `/api/v1/wallet/cards/${userA.walletCardHarborId}/payment-settings`,
              )
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken)
              .send({ dueDay: 1, isAutopay: true }),
        },
        {
          label: "PATCH /api/v1/wallet/cards/:id/payment-settings",
          exec: () =>
            request(app)
              .patch(
                `/api/v1/wallet/cards/${userA.walletCardHarborId}/payment-settings`,
              )
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken)
              .send({ dueDay: 2, isAutopay: true }),
        },
        {
          label: "POST /api/v1/wallet/cards/:id/paid-cycles",
          exec: () =>
            request(app)
              .post(
                `/api/v1/wallet/cards/${userA.walletCardHarborId}/paid-cycles`,
              )
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken)
              .send({ cycleYearMonth: "2026-11" }),
        },
        {
          label: "POST /api/v1/wallet/cards/:id/quarter-activations",
          exec: () =>
            request(app)
              .post(
                `/api/v1/wallet/cards/${userA.walletCardOrbitId}/quarter-activations`,
              )
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken)
              .send({ quarter: "2027-Q1" }),
        },
        {
          label: "PUT /api/v1/wallet/cards/:id/quarter-activations",
          exec: () =>
            request(app)
              .put(
                `/api/v1/wallet/cards/${userA.walletCardOrbitId}/quarter-activations`,
              )
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken)
              .send({ quarter: "2027-Q1" }),
        },
        {
          label: "POST /api/v1/wallet/cards/:walletCardId/perks/:perkId/usage",
          exec: () =>
            request(app)
              .post(
                `/api/v1/wallet/cards/${userA.walletCardHarborId}/perks/${ridePerkId}/usage`,
              )
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken)
              .send({ usedCents: 1500 }),
        },
        {
          label: "PUT /api/v1/wallet/cards/:walletCardId/perks/:perkId/usage",
          exec: () =>
            request(app)
              .put(
                `/api/v1/wallet/cards/${userA.walletCardHarborId}/perks/${ridePerkId}/usage`,
              )
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken)
              .send({ isFull: true }),
        },
        {
          label: "POST /api/v1/perks/:perkId/use",
          exec: () =>
            request(app)
              .post(`/api/v1/perks/${ridePerkId}/use`)
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken)
              .send({
                walletCardId: userA.walletCardHarborId,
                usedCents: 1500,
              }),
        },
        {
          label: "POST /api/v1/notifications/:id/dismiss",
          exec: () =>
            request(app)
              .post(`/api/v1/notifications/${userA.notificationId}/dismiss`)
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken),
        },
        {
          label: "PATCH /api/v1/notifications/:id/dismiss",
          exec: () =>
            request(app)
              .patch(`/api/v1/notifications/${userA.notificationId}/dismiss`)
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken),
        },
        {
          label: "DELETE /api/v1/notifications/:id",
          exec: () =>
            request(app)
              .delete(`/api/v1/notifications/${userA.notificationId}`)
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken),
        },
        {
          label: "PUT /api/v1/points-balances/:programId",
          exec: () =>
            request(app)
              .put(`/api/v1/points-balances/${harborProgramId}`)
              .set("Cookie", userB.cookiesWithCsrf)
              .set("x-csrf-token", userB.csrfToken)
              .send({ pointsBalance: 99999, expiryDate: "2027-06-30" }),
        },
      ];

      for (const attempt of crossUserAttempts) {
        await prisma.rateLimit.deleteMany();
        const res = await attempt.exec();
        expect(
          res.status,
          `Expected 404 on cross-user ${attempt.label}, got ${res.status}`,
        ).toBe(404);
      }

      // Also verify user-scoped bulk mutations by User B do not touch User A's records
      const dismissAllB = await request(app)
        .post("/api/v1/notifications/dismiss-all")
        .set("Cookie", userB.cookiesWithCsrf)
        .set("x-csrf-token", userB.csrfToken);
      expect(dismissAllB.status).toBe(200);

      const updatePrefB = await request(app)
        .put("/api/v1/notification-preferences")
        .set("Cookie", userB.cookiesWithCsrf)
        .set("x-csrf-token", userB.csrfToken)
        .send({ type: "PAYMENT_DUE", enabled: true });
      expect(updatePrefB.status).toBe(200);

      // Verify all of User A's data is unchanged in the database afterwards
      const aHarborAfter = await prisma.walletCard.findUniqueOrThrow({
        where: { id: userA.walletCardHarborId },
        include: {
          paymentSetting: true,
          paidCycles: true,
          perkUsages: true,
          bonusOffer: true,
          spendEntries: true,
        },
      });
      expect(aHarborAfter.nickname).toBe("User A Harbor");
      expect(aHarborAfter.paymentSetting?.dueDay).toBe(15);
      expect(aHarborAfter.paymentSetting?.isAutopay).toBe(false);
      expect(aHarborAfter.paidCycles.map((c) => c.cycleYearMonth)).toEqual([
        "2026-10",
      ]);
      expect(aHarborAfter.perkUsages).toHaveLength(1);
      expect(aHarborAfter.perkUsages[0]?.usedCents).toBe(400);
      expect(aHarborAfter.bonusOffer?.id).toBe(userA.walletCardBonusOfferId);
      expect(aHarborAfter.bonusOffer?.spendRequirementCents).toBe(400000);
      expect(aHarborAfter.bonusOffer?.windowMonths).toBe(3);
      expect(aHarborAfter.bonusOffer?.bonusPoints).toBe(60000);
      expect(aHarborAfter.spendEntries).toHaveLength(1);
      expect(aHarborAfter.spendEntries[0]?.id).toBe(userA.spendEntryId);
      expect(aHarborAfter.spendEntries[0]?.amountCents).toBe(50000);
      expect(
        aHarborAfter.spendEntries[0]?.date.toISOString().slice(0, 10),
      ).toBe("2025-02-01");
      expect(aHarborAfter.spendEntries[0]?.note).toBe("User A initial spend");

      const aOrbitAfter = await prisma.walletCard.findUniqueOrThrow({
        where: { id: userA.walletCardOrbitId },
        include: { quarterActivations: true },
      });
      expect(aOrbitAfter.quarterActivations.map((q) => q.quarter)).toEqual([
        "2026-Q4",
      ]);

      const aBalanceAfter = await prisma.programBalance.findUniqueOrThrow({
        where: { id: userA.programBalanceId },
      });
      expect(aBalanceAfter.pointsBalance).toBe(10000);
      expect(aBalanceAfter.expiryDate.toISOString().slice(0, 10)).toBe(
        "2026-12-31",
      );

      const aNotifAfter = await prisma.notification.findUniqueOrThrow({
        where: { id: userA.notificationId },
      });
      expect(aNotifAfter.dismissedAt).toBeNull();

      const aPrefAfter = await prisma.notificationPreference.findUniqueOrThrow({
        where: { id: userA.notificationPreferenceId },
      });
      expect(aPrefAfter.type).toBe("PERK_ENDING");
      expect(aPrefAfter.enabled).toBe(false);
    });

    it("AC2 (Card-number guard): rejects Luhn-valid numbers (spaces, dashes, contiguous, embedded) with 400 and never stores, echoes, or logs them", async () => {
      const capturedLogs: string[] = [];
      const logSpy = vi
        .spyOn(console, "log")
        .mockImplementation((...args: unknown[]) => {
          capturedLogs.push(args.map(String).join(" "));
        });
      const infoSpy = vi
        .spyOn(console, "info")
        .mockImplementation((...args: unknown[]) => {
          capturedLogs.push(args.map(String).join(" "));
        });
      const warnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation((...args: unknown[]) => {
          capturedLogs.push(args.map(String).join(" "));
        });
      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation((...args: unknown[]) => {
          capturedLogs.push(args.map(String).join(" "));
        });

      try {
        for (const payload of LUHN_CARD_PAYLOADS) {
          await prisma.rateLimit.deleteMany();

          // 1. POST /api/v1/auth/signup (free-text: name)
          const signupRes = await request(app)
            .post("/api/v1/auth/signup")
            .set("Cookie", userA.cookiesWithCsrf)
            .set("x-csrf-token", userA.csrfToken)
            .send({
              name: payload.input,
              email: "card-attempt@example.com",
              password: "Password123",
              confirmPassword: "Password123",
            });
          expect(signupRes.status).toBe(400);
          expect(JSON.stringify(signupRes.body)).not.toContain(payload.input);
          expect(JSON.stringify(signupRes.body)).not.toContain(
            payload.rawDigits,
          );

          await prisma.rateLimit.deleteMany();

          // 2. POST /api/v1/wallet/cards (free-text: nickname)
          const addCardRes = await request(app)
            .post("/api/v1/wallet/cards")
            .set("Cookie", userA.cookiesWithCsrf)
            .set("x-csrf-token", userA.csrfToken)
            .send({
              cardId: harborCardId,
              nickname: payload.input,
            });
          expect(addCardRes.status).toBe(400);
          expect(JSON.stringify(addCardRes.body)).not.toContain(payload.input);
          expect(JSON.stringify(addCardRes.body)).not.toContain(
            payload.rawDigits,
          );

          // 3. PATCH /api/v1/wallet/cards/:id (free-text: nickname)
          const patchCardRes = await request(app)
            .patch(`/api/v1/wallet/cards/${userA.walletCardHarborId}`)
            .set("Cookie", userA.cookiesWithCsrf)
            .set("x-csrf-token", userA.csrfToken)
            .send({
              nickname: payload.input,
            });
          expect(patchCardRes.status).toBe(400);
          expect(JSON.stringify(patchCardRes.body)).not.toContain(
            payload.input,
          );
          expect(JSON.stringify(patchCardRes.body)).not.toContain(
            payload.rawDigits,
          );

          // 4. GET /api/v1/stores/search?q=... (free-text: q)
          const searchStoresRes = await request(app)
            .get(`/api/v1/stores/search?q=${encodeURIComponent(payload.input)}`)
            .set("Cookie", userA.authCookie);
          expect(searchStoresRes.status).toBe(400);
          expect(JSON.stringify(searchStoresRes.body)).not.toContain(
            payload.input,
          );
          expect(JSON.stringify(searchStoresRes.body)).not.toContain(
            payload.rawDigits,
          );

          // 5. GET /api/v1/stores?q=... and ?query=... (free-text: q / query)
          const storesQRes = await request(app)
            .get(`/api/v1/stores?q=${encodeURIComponent(payload.input)}`)
            .set("Cookie", userA.authCookie);
          expect(storesQRes.status).toBe(400);
          expect(JSON.stringify(storesQRes.body)).not.toContain(payload.input);
          expect(JSON.stringify(storesQRes.body)).not.toContain(
            payload.rawDigits,
          );

          const storesQueryRes = await request(app)
            .get(`/api/v1/stores?query=${encodeURIComponent(payload.input)}`)
            .set("Cookie", userA.authCookie);
          expect(storesQueryRes.status).toBe(400);
          expect(JSON.stringify(storesQueryRes.body)).not.toContain(
            payload.input,
          );
          expect(JSON.stringify(storesQueryRes.body)).not.toContain(
            payload.rawDigits,
          );

          await prisma.rateLimit.deleteMany();

          // 6. Spend entry free-text `note` field across all 6 POST/PATCH/PUT endpoints
          const spendEntryNoteRequests = [
            request(app)
              .post(
                `/api/v1/wallet/cards/${userA.walletCardHarborId}/spend-entries`,
              )
              .set("Cookie", userA.cookiesWithCsrf)
              .set("x-csrf-token", userA.csrfToken)
              .send({
                amountCents: 2500,
                date: "2025-02-20",
                note: payload.input,
              }),
            request(app)
              .post(
                `/api/v1/wallet/cards/${userA.walletCardHarborId}/spending-entries`,
              )
              .set("Cookie", userA.cookiesWithCsrf)
              .set("x-csrf-token", userA.csrfToken)
              .send({
                amountCents: 2500,
                date: "2025-02-20",
                note: payload.input,
              }),
            request(app)
              .patch(
                `/api/v1/wallet/cards/${userA.walletCardHarborId}/spend-entries/${userA.spendEntryId}`,
              )
              .set("Cookie", userA.cookiesWithCsrf)
              .set("x-csrf-token", userA.csrfToken)
              .send({ note: payload.input }),
            request(app)
              .patch(
                `/api/v1/wallet/cards/${userA.walletCardHarborId}/spending-entries/${userA.spendEntryId}`,
              )
              .set("Cookie", userA.cookiesWithCsrf)
              .set("x-csrf-token", userA.csrfToken)
              .send({ note: payload.input }),
            request(app)
              .patch(`/api/v1/spend-entries/${userA.spendEntryId}`)
              .set("Cookie", userA.cookiesWithCsrf)
              .set("x-csrf-token", userA.csrfToken)
              .send({ note: payload.input }),
            request(app)
              .put(`/api/v1/spend-entries/${userA.spendEntryId}`)
              .set("Cookie", userA.cookiesWithCsrf)
              .set("x-csrf-token", userA.csrfToken)
              .send({
                amountCents: 2500,
                date: "2025-02-20",
                note: payload.input,
              }),
          ];

          for (const spendReq of spendEntryNoteRequests) {
            const spendRes = await spendReq;
            expect(spendRes.status).toBe(400);
            expect(JSON.stringify(spendRes.body)).not.toContain(payload.input);
            expect(JSON.stringify(spendRes.body)).not.toContain(
              payload.rawDigits,
            );
          }
        }

        // Assert captured logs never contain any card numbers
        const combinedLogs = capturedLogs.join("\n");
        for (const payload of LUHN_CARD_PAYLOADS) {
          expect(combinedLogs).not.toContain(payload.input);
          expect(combinedLogs).not.toContain(payload.rawDigits);
        }

        // Assert the database never stored any card numbers
        const allUsers = await prisma.user.findMany();
        const allWalletCards = await prisma.walletCard.findMany();
        const allSpendEntries = await prisma.spendEntry.findMany();
        const dbSnapshot = JSON.stringify({
          allUsers,
          allWalletCards,
          allSpendEntries,
        });
        for (const payload of LUHN_CARD_PAYLOADS) {
          expect(dbSnapshot).not.toContain(payload.input);
          expect(dbSnapshot).not.toContain(payload.rawDigits);
        }
        expect(
          await prisma.user.findUnique({
            where: { email: "card-attempt@example.com" },
          }),
        ).toBeNull();
        const aEntryAfter = await prisma.spendEntry.findUniqueOrThrow({
          where: { id: userA.spendEntryId },
        });
        expect(aEntryAfter.note).toBe("User A initial spend");
      } finally {
        logSpy.mockRestore();
        infoSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });
  },
);
