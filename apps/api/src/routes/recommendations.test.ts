import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";
import { createApp } from "../app.js";
import { getJwtSecret } from "../middleware/auth.middleware.js";
import { RankableCard } from "../domain/rank-cards.js";
import { DEMO_CARDS, DEMO_PROGRAMS } from "../seed-data.js";

function buildSeedRankableCards(): RankableCard[] {
  return DEMO_CARDS.map((seedCard, idx) => {
    const program = DEMO_PROGRAMS.find((p) => p.name === seedCard.programName)!;
    return {
      walletCardId: `wc-${idx + 1}`,
      cardId: `card-${idx + 1}`,
      name: seedCard.name,
      issuer: seedCard.issuer,
      artColor: seedCard.artColor,
      isDemo: seedCard.isDemo,
      nickname: null,
      annualFeeCents: seedCard.annualFeeCents,
      baseRateX100: seedCard.baseRateX100,
      program: {
        name: program.name,
        centsPer100Points: program.centsPer100Points,
      },
      rules: seedCard.rules.map((r) => ({
        category: r.category,
        rateX100: r.rateX100,
        capCents: r.capCents ?? null,
      })),
    };
  });
}

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

describe("GET /api/v1/recommendations route tests (US-03 / Issue #12)", () => {
  let mockCardsByUser: Record<string, RankableCard[]> = {};

  const fakePrisma = {
    $executeRawUnsafe: async () => 0,
    $queryRawUnsafe: async () => [
      { total_hits: 1, reset_time: new Date(Date.now() + 60000) },
    ],
  } as unknown as Parameters<typeof createApp>[0] extends { prisma?: infer P }
    ? P
    : never;

  const app = createApp({ prisma: fakePrisma, rateLimitMax: 100 });

  beforeEach(() => {
    mockCardsByUser = {};
    app.set("recommendationRepo", {
      findWalletCardsByUserId: async (userId: string) =>
        mockCardsByUser[userId] ?? [],
    });
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get(
      "/api/v1/recommendations?category=GROCERIES",
    );
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when category or amountCents is invalid", async () => {
    const cookie = await createAuthCookie("user-1", "priya@example.com");

    const badCat = await request(app)
      .get("/api/v1/recommendations?category=UNKNOWN")
      .set("Cookie", cookie);
    expect(badCat.status).toBe(400);
    expect(badCat.body.error.code).toBe("VALIDATION_ERROR");

    const badAmount = await request(app)
      .get("/api/v1/recommendations?category=GROCERIES&amountCents=0")
      .set("Cookie", cookie);
    expect(badAmount.status).toBe(400);
    expect(badAmount.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("AC1 & AC2: ranks seed wallet cards for GROCERIES on $100 (Mint Everyday $4.00, Basic Flat $1.50, Harbor Travel Plus $1.25)", async () => {
    mockCardsByUser["user-1"] = buildSeedRankableCards();
    const cookie = await createAuthCookie("user-1", "priya@example.com");

    const res = await request(app)
      .get("/api/v1/recommendations?category=GROCERIES")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.category).toBe("GROCERIES");
    expect(res.body.amountCents).toBe(10000);
    expect(res.body.isEmptyWallet).toBe(false);
    expect(
      res.body.rankedCards.map(
        (c: { name: string; rewardCents: number; isDemo: boolean }) => ({
          name: c.name,
          rewardCents: c.rewardCents,
          isDemo: c.isDemo,
        }),
      ),
    ).toEqual([
      { name: "Mint Everyday", rewardCents: 400, isDemo: true },
      { name: "Basic Flat", rewardCents: 150, isDemo: true },
      { name: "Harbor Travel Plus", rewardCents: 125, isDemo: true },
    ]);
  });

  it("AC5: returns isEmptyWallet=true and empty rankedCards when user has no cards", async () => {
    mockCardsByUser["user-empty"] = [];
    const cookie = await createAuthCookie("user-empty", "empty@example.com");

    const res = await request(app)
      .get("/api/v1/recommendations?category=DINING")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      category: "DINING",
      amountCents: 10000,
      isEmptyWallet: true,
      rankedCards: [],
    });
  });
});
