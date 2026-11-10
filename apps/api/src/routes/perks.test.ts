import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";
import { createApp } from "../app.js";
import { getJwtSecret } from "../middleware/auth.middleware.js";
import { getCsrfTokenAndCookie } from "./test-helpers.js";

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

interface MockPerkResponseItem {
  perkId: string;
  amountCents: number;
  usedCents: number;
  leftCents: number;
  periodKey: string;
  endDate: string;
  daysLeft: number;
  isUsed: boolean;
}

describe("Perks API routes (US-06 / Issue #21)", () => {
  const USER_A_ID = "11111111-1111-4111-8111-111111111111";
  const USER_B_ID = "22222222-2222-4222-8222-222222222222";
  const WALLET_CARD_A_ID = "wc-aaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const WALLET_CARD_B_ID = "wc-bbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const CARD_HARBOR_ID = "card-harbor-id";
  const PERK_RIDE_ID = "perk-ride-id";
  const PERK_DINING_ID = "perk-dining-id";

  let currentNow = new Date("2026-11-10T18:00:00.000Z");
  let cookieUserA: string;
  let cookieUserB: string;

  // In-memory data for fake Prisma
  let mockWalletCards: Array<{
    id: string;
    userId: string;
    cardId: string;
    nickname: string | null;
    card: {
      id: string;
      name: string;
      artColor: string;
      perks: Array<{
        id: string;
        cardId: string;
        name: string;
        amountCents: number;
        period: "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
      }>;
    };
  }> = [];

  let mockPerkUsages: Record<
    string,
    {
      id: string;
      walletCardId: string;
      perkId: string;
      periodKey: string;
      usedCents: number;
    }
  > = {};

  const fakePrisma = {
    $executeRawUnsafe: async () => 0,
    $queryRawUnsafe: async () => [{ 1: 1 }],
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (where.id === USER_A_ID) {
          return { id: USER_A_ID, timeZone: "America/Los_Angeles" };
        }
        if (where.id === USER_B_ID) {
          return { id: USER_B_ID, timeZone: "America/Los_Angeles" };
        }
        return null;
      },
    },
    walletCard: {
      findMany: async ({ where }: { where: { userId: string } }) => {
        return mockWalletCards.filter((wc) => wc.userId === where.userId);
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const found = mockWalletCards.find((wc) => wc.id === where.id);
        return found || null;
      },
    },
    perk: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        for (const wc of mockWalletCards) {
          const p = wc.card.perks.find((x) => x.id === where.id);
          if (p) return p;
        }
        return null;
      },
    },
    perkUsage: {
      findUnique: async ({
        where,
      }: {
        where: {
          walletCardId_perkId_periodKey?: {
            walletCardId: string;
            perkId: string;
            periodKey: string;
          };
        };
      }) => {
        if (where.walletCardId_perkId_periodKey) {
          const { walletCardId, perkId, periodKey } =
            where.walletCardId_perkId_periodKey;
          const key = `${walletCardId}:${perkId}:${periodKey}`;
          return mockPerkUsages[key] || null;
        }
        return null;
      },
      findMany: async ({
        where,
      }: {
        where: { walletCardId?: { in: string[] } };
      }) => {
        return Object.values(mockPerkUsages).filter((u) =>
          where.walletCardId?.in?.includes(u.walletCardId),
        );
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: {
          walletCardId_perkId_periodKey: {
            walletCardId: string;
            perkId: string;
            periodKey: string;
          };
        };
        create: {
          walletCardId: string;
          perkId: string;
          periodKey: string;
          usedCents: number;
        };
        update: { usedCents: number };
      }) => {
        const { walletCardId, perkId, periodKey } =
          where.walletCardId_perkId_periodKey;
        const key = `${walletCardId}:${perkId}:${periodKey}`;
        const existing = mockPerkUsages[key];
        if (existing) {
          existing.usedCents = update.usedCents;
          return existing;
        }
        const created = {
          id: `pu-${Date.now()}`,
          walletCardId,
          perkId,
          periodKey,
          usedCents: create.usedCents,
        };
        mockPerkUsages[key] = created;
        return created;
      },
    },
  };

  const app = createApp({
    prisma: fakePrisma as unknown as NonNullable<
      Parameters<typeof createApp>[0]
    >["prisma"],
    schema: "test",
    rateLimitMax: 100,
    generalRateLimitMax: 100,
    nowProvider: () => currentNow,
  });

  beforeEach(async () => {
    currentNow = new Date("2026-11-10T18:00:00.000Z");
    cookieUserA = await createAuthCookie(USER_A_ID, "user-a@example.com");
    cookieUserB = await createAuthCookie(USER_B_ID, "user-b@example.com");

    mockWalletCards = [
      {
        id: WALLET_CARD_A_ID,
        userId: USER_A_ID,
        cardId: CARD_HARBOR_ID,
        nickname: "My Harbor Card",
        card: {
          id: CARD_HARBOR_ID,
          name: "Harbor Travel Plus",
          artColor: "#2F74D0",
          perks: [
            {
              id: PERK_DINING_ID,
              cardId: CARD_HARBOR_ID,
              name: "Dining credit",
              amountCents: 1000,
              period: "MONTHLY",
            },
            {
              id: PERK_RIDE_ID,
              cardId: CARD_HARBOR_ID,
              name: "Ride credit",
              amountCents: 1500,
              period: "MONTHLY",
            },
          ],
        },
      },
      {
        id: WALLET_CARD_B_ID,
        userId: USER_B_ID,
        cardId: CARD_HARBOR_ID,
        nickname: "User B Harbor Card",
        card: {
          id: CARD_HARBOR_ID,
          name: "Harbor Travel Plus",
          artColor: "#2F74D0",
          perks: [
            {
              id: PERK_DINING_ID,
              cardId: CARD_HARBOR_ID,
              name: "Dining credit",
              amountCents: 1000,
              period: "MONTHLY",
            },
          ],
        },
      },
    ];

    mockPerkUsages = {};
  });

  describe("GET /api/v1/perks", () => {
    it("requires login and returns 401 when unauthenticated", async () => {
      const res = await request(app).get("/api/v1/perks");
      expect(res.status).toBe(401);
    });

    it("AC1: lists wallet card perks with used and left for current period", async () => {
      // Seed some partial usage for ride credit
      mockPerkUsages[`${WALLET_CARD_A_ID}:${PERK_RIDE_ID}:2026-11`] = {
        id: "pu-1",
        walletCardId: WALLET_CARD_A_ID,
        perkId: PERK_RIDE_ID,
        periodKey: "2026-11",
        usedCents: 500,
      };

      const res = await request(app)
        .get("/api/v1/perks")
        .set("Cookie", cookieUserA);

      expect(res.status).toBe(200);
      expect(res.body.perks).toHaveLength(2);

      const ridePerk = res.body.perks.find(
        (p: MockPerkResponseItem) => p.perkId === PERK_RIDE_ID,
      );
      expect(ridePerk).toBeDefined();
      expect(ridePerk.amountCents).toBe(1500);
      expect(ridePerk.usedCents).toBe(500);
      expect(ridePerk.leftCents).toBe(1000);
      expect(ridePerk.periodKey).toBe("2026-11");
      expect(ridePerk.endDate).toBe("2026-11-30");
      expect(ridePerk.daysLeft).toBe(20);
      expect(ridePerk.isUsed).toBe(false);

      const diningPerk = res.body.perks.find(
        (p: MockPerkResponseItem) => p.perkId === PERK_DINING_ID,
      );
      expect(diningPerk).toBeDefined();
      expect(diningPerk.usedCents).toBe(0);
      expect(diningPerk.leftCents).toBe(1000);

      expect(res.body.summary).toEqual({
        totalAmountCents: 2500,
        totalUsedCents: 500,
        totalLeftCents: 2000,
      });
    });

    it("multi-tenant isolation: does not return perks belonging to another user", async () => {
      const res = await request(app)
        .get("/api/v1/perks")
        .set("Cookie", cookieUserB);

      expect(res.status).toBe(200);
      expect(res.body.perks).toHaveLength(1);
      expect(res.body.perks[0].walletCardId).toBe(WALLET_CARD_B_ID);
    });
  });

  describe("POST /api/v1/wallet/cards/:walletCardId/perks/:perkId/usage", () => {
    it("AC2: marks a perk as partly used", async () => {
      const { token, cookie } = await getCsrfTokenAndCookie(app);

      const res = await request(app)
        .post(
          `/api/v1/wallet/cards/${WALLET_CARD_A_ID}/perks/${PERK_RIDE_ID}/usage`,
        )
        .set("Cookie", `${cookieUserA}; ${cookie}`)
        .set("x-csrf-token", token)
        .send({ usedCents: 750 });

      expect(res.status).toBe(200);
      expect(res.body.perk.usedCents).toBe(750);
      expect(res.body.perk.leftCents).toBe(750);
      expect(res.body.perk.isUsed).toBe(false);
    });

    it("AC2: marks a perk as fully used", async () => {
      const { token, cookie } = await getCsrfTokenAndCookie(app);

      const res = await request(app)
        .post(
          `/api/v1/wallet/cards/${WALLET_CARD_A_ID}/perks/${PERK_RIDE_ID}/usage`,
        )
        .set("Cookie", `${cookieUserA}; ${cookie}`)
        .set("x-csrf-token", token)
        .send({ isFull: true });

      expect(res.status).toBe(200);
      expect(res.body.perk.usedCents).toBe(1500);
      expect(res.body.perk.leftCents).toBe(0);
      expect(res.body.perk.isUsed).toBe(true);
    });

    it("AC2: rejects usage when usedCents exceeds perk amount with 400", async () => {
      const { token, cookie } = await getCsrfTokenAndCookie(app);

      const res = await request(app)
        .post(
          `/api/v1/wallet/cards/${WALLET_CARD_A_ID}/perks/${PERK_RIDE_ID}/usage`,
        )
        .set("Cookie", `${cookieUserA}; ${cookie}`)
        .set("x-csrf-token", token)
        .send({ usedCents: 2000 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("USAGE_EXCEEDS_PERK_AMOUNT");
    });

    it("security: returns 404 when user tries to update another user's wallet card perk", async () => {
      const { token, cookie } = await getCsrfTokenAndCookie(app);

      // User A attempts to update User B's card
      const res = await request(app)
        .post(
          `/api/v1/wallet/cards/${WALLET_CARD_B_ID}/perks/${PERK_DINING_ID}/usage`,
        )
        .set("Cookie", `${cookieUserA}; ${cookie}`)
        .set("x-csrf-token", token)
        .send({ usedCents: 500 });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("requires CSRF token for state-changing usage requests", async () => {
      const res = await request(app)
        .post(
          `/api/v1/wallet/cards/${WALLET_CARD_A_ID}/perks/${PERK_RIDE_ID}/usage`,
        )
        .set("Cookie", cookieUserA)
        .send({ usedCents: 500 });

      expect(res.status).toBe(403);
    });
  });
});
