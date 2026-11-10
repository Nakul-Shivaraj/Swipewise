import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../app.js";
import { getJwtSecret } from "../middleware/auth.middleware.js";
import { getCsrfTokenAndCookie } from "./test-helpers.js";
import { BonusRepository } from "../repositories/bonus.repository.js";

async function createAuthCookie(
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

describe("Bonus API routes unit tests (US-07 / Issue #22)", () => {
  const USER_A_ID = "11111111-1111-4111-8111-111111111111";
  const USER_B_ID = "22222222-2222-4222-8222-222222222222";
  const WALLET_CARD_ID = "wc-1111-2222-3333-444444444444";
  const SPEND_ENTRY_ID = "se-1111-2222-3333-444444444444";

  let cookieUserA: string;
  let cookieUserB: string;

  const fakePrisma = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id === USER_A_ID) {
          return { id: USER_A_ID, email: "user-a@example.com", name: "User A" };
        }
        if (where.id === USER_B_ID) {
          return { id: USER_B_ID, email: "user-b@example.com", name: "User B" };
        }
        return null;
      }),
    },
    $queryRawUnsafe: vi.fn(async () => [{ total_hits: 1 }]),
  } as unknown as PrismaClient;

  let mockBonusRepo: BonusRepository;

  beforeEach(async () => {
    cookieUserA = await createAuthCookie(USER_A_ID, "user-a@example.com");
    cookieUserB = await createAuthCookie(USER_B_ID, "user-b@example.com");

    mockBonusRepo = {
      getUserBonusOffers: vi.fn(async (userId: string) => {
        if (userId !== USER_A_ID) return [];
        return [
          {
            walletCardId: WALLET_CARD_ID,
            cardName: "Harbor Travel Plus",
            requiredSpendCents: 300000,
            spendRequirementCents: 300000,
            windowMonths: 3,
            bonusPoints: 60000,
            openedDate: "2026-01-01",
            deadline: "2026-04-01",
            daysLeft: 45,
            spentCents: 100000,
            remainingCents: 200000,
            progressPercent: 33,
            status: "In progress",
            requiresOpenDate: false,
            spendEntries: [],
          },
        ];
      }),
      getBonusOfferByWalletCardId: vi.fn(
        async (walletCardId: string, userId: string) => {
          if (userId !== USER_A_ID || walletCardId !== WALLET_CARD_ID) {
            return null;
          }
          return {
            walletCardId: WALLET_CARD_ID,
            cardName: "Harbor Travel Plus",
            requiredSpendCents: 300000,
            spendRequirementCents: 300000,
            windowMonths: 3,
            bonusPoints: 60000,
            openedDate: "2026-01-01",
            deadline: "2026-04-01",
            daysLeft: 45,
            spentCents: 100000,
            remainingCents: 200000,
            progressPercent: 33,
            status: "In progress",
            requiresOpenDate: false,
            spendEntries: [],
          };
        },
      ),
      addSpendEntry: vi.fn(
        async (
          userId: string,
          walletCardId: string,
          data: { amountCents: number; date: string; note?: string | null },
        ) => {
          if (userId !== USER_A_ID || walletCardId !== WALLET_CARD_ID) {
            return null;
          }
          return {
            id: SPEND_ENTRY_ID,
            walletCardId,
            walletCardBonusOfferId: "offer-1",
            amountCents: data.amountCents,
            date: data.date,
            note: data.note || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        },
      ),
      updateSpendEntry: vi.fn(
        async (
          userId: string,
          spendEntryId: string,
          data: { amountCents?: number; date?: string; note?: string | null },
        ) => {
          if (userId !== USER_A_ID || spendEntryId !== SPEND_ENTRY_ID) {
            return null;
          }
          return {
            id: SPEND_ENTRY_ID,
            walletCardId: WALLET_CARD_ID,
            walletCardBonusOfferId: "offer-1",
            amountCents: data.amountCents ?? 100000,
            date: data.date ?? "2026-01-15",
            note: data.note !== undefined ? data.note : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        },
      ),
      deleteSpendEntry: vi.fn(async (userId: string, spendEntryId: string) => {
        if (userId !== USER_A_ID || spendEntryId !== SPEND_ENTRY_ID) {
          return false;
        }
        return true;
      }),
    } as unknown as BonusRepository;
  });

  const getApp = () => {
    const app = createApp({
      prisma: fakePrisma,
      schema: "test",
      rateLimitMax: 100,
      generalRateLimitMax: 100,
    });
    app.set("bonusRepo", mockBonusRepo);
    return app;
  };

  it("requires authentication for all bonus routes", async () => {
    const app = getApp();
    const res1 = await request(app).get("/api/v1/bonus-offers");
    expect(res1.status).toBe(401);

    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const res2 = await request(app)
      .post(`/api/v1/wallet/cards/${WALLET_CARD_ID}/spend-entries`)
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie);
    expect(res2.status).toBe(401);
  });

  it("returns bonus offers list for authenticated user", async () => {
    const app = getApp();
    const res = await request(app)
      .get("/api/v1/bonus-offers")
      .set("Cookie", cookieUserA);
    expect(res.status).toBe(200);
    expect(res.body.bonuses).toHaveLength(1);
    expect(res.body.bonuses[0].cardName).toBe("Harbor Travel Plus");
  });

  it("adds spend entry for card owner", async () => {
    const app = getApp();
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);

    const res = await request(app)
      .post(`/api/v1/wallet/cards/${WALLET_CARD_ID}/spend-entries`)
      .set("Cookie", `${cookieUserA}; ${csrfCookie}`)
      .set("x-csrf-token", csrfToken)
      .send({
        amountCents: 5000,
        date: "2026-01-20",
        note: "Groceries",
      });

    expect(res.status).toBe(201);
    expect(res.body.spendEntry.amountCents).toBe(5000);
  });

  it("returns 404 when adding spend entry to non-existent or other user card", async () => {
    const app = getApp();
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);

    const res = await request(app)
      .post(`/api/v1/wallet/cards/${WALLET_CARD_ID}/spend-entries`)
      .set("Cookie", `${cookieUserB}; ${csrfCookie}`)
      .set("x-csrf-token", csrfToken)
      .send({
        amountCents: 5000,
        date: "2026-01-20",
      });

    expect(res.status).toBe(404);
  });

  it("updates spend entry for owner and returns 404 for other user", async () => {
    const app = getApp();
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);

    const res1 = await request(app)
      .patch(`/api/v1/spend-entries/${SPEND_ENTRY_ID}`)
      .set("Cookie", `${cookieUserA}; ${csrfCookie}`)
      .set("x-csrf-token", csrfToken)
      .send({
        amountCents: 8000,
      });
    expect(res1.status).toBe(200);
    expect(res1.body.spendEntry.amountCents).toBe(8000);

    const res2 = await request(app)
      .patch(`/api/v1/spend-entries/${SPEND_ENTRY_ID}`)
      .set("Cookie", `${cookieUserB}; ${csrfCookie}`)
      .set("x-csrf-token", csrfToken)
      .send({
        amountCents: 8000,
      });
    expect(res2.status).toBe(404);
  });

  it("deletes spend entry for owner and returns 404 for other user", async () => {
    const app = getApp();
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);

    const res1 = await request(app)
      .delete(`/api/v1/spend-entries/${SPEND_ENTRY_ID}`)
      .set("Cookie", `${cookieUserB}; ${csrfCookie}`)
      .set("x-csrf-token", csrfToken);
    expect(res1.status).toBe(404);

    const res2 = await request(app)
      .delete(`/api/v1/spend-entries/${SPEND_ENTRY_ID}`)
      .set("Cookie", `${cookieUserA}; ${csrfCookie}`)
      .set("x-csrf-token", csrfToken);
    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);
  });
});
