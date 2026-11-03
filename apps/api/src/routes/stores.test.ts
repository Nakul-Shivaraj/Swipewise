import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";
import { StoreSearchResult } from "@swipewise/shared";
import { createApp } from "../app.js";
import { getJwtSecret } from "../middleware/auth.middleware.js";
import { RankableCard } from "../domain/rank-cards.js";
import { DEMO_CARDS, DEMO_PROGRAMS, DEMO_STORES } from "../seed-data.js";

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

function buildSeedStoreResults(): StoreSearchResult[] {
  return DEMO_STORES.map((store, idx) => ({
    id: `store-${idx + 1}`,
    name: store.name,
    category: store.category,
    aliases: [...store.aliases],
  }));
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

describe("GET /api/v1/stores/search route tests (US-04 / Issue #13)", () => {
  let mockCardsByUser: Record<string, RankableCard[]> = {};
  let mockStores: StoreSearchResult[] = [];

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
    mockStores = buildSeedStoreResults();
    app.set("recommendationRepo", {
      findWalletCardsByUserId: async (userId: string) =>
        mockCardsByUser[userId] ?? [],
    });
    app.set("storeRepo", {
      searchStores: async (query: string) => {
        const lower = query.toLowerCase();
        return mockStores
          .filter(
            (s) =>
              s.name.toLowerCase().includes(lower) ||
              s.aliases.some((a) => a.toLowerCase().includes(lower)),
          )
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, 10);
      },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/v1/stores/search?q=Safeway");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when search query is missing, empty, >100 chars, or contains a card number", async () => {
    const cookie = await createAuthCookie("user-1", "priya@example.com");

    const missing = await request(app)
      .get("/api/v1/stores/search")
      .set("Cookie", cookie);
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("VALIDATION_ERROR");

    const empty = await request(app)
      .get("/api/v1/stores/search?q=%20%20")
      .set("Cookie", cookie);
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("VALIDATION_ERROR");

    const tooLong = await request(app)
      .get(`/api/v1/stores/search?q=${"a".repeat(101)}`)
      .set("Cookie", cookie);
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.code).toBe("VALIDATION_ERROR");

    const cardNumber = await request(app)
      .get("/api/v1/stores/search?q=4532015112830366")
      .set("Cookie", cookie);
    expect(cardNumber.status).toBe(400);
    expect(cardNumber.body.error.code).toBe("VALIDATION_ERROR");
  });

  it('AC1 & AC2: "SAFEWAY", "safeway", and alias "safeway.com" all find Safeway (GROCERIES), and reusing #12 ranking with 3 demo cards and $100 ranks Mint Everyday first at $4.00', async () => {
    mockCardsByUser["user-1"] = buildSeedRankableCards();
    const cookie = await createAuthCookie("user-1", "priya@example.com");

    for (const query of ["SAFEWAY", "safeway", "safeway.com"]) {
      const searchRes = await request(app)
        .get(`/api/v1/stores/search?q=${encodeURIComponent(query)}`)
        .set("Cookie", cookie);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.stores).toHaveLength(1);
      expect(searchRes.body.stores[0].name).toBe("Safeway");
      expect(searchRes.body.stores[0].category).toBe("GROCERIES");

      // Map store -> category and reuse #12 ranking
      const recRes = await request(app)
        .get(
          `/api/v1/recommendations?category=${searchRes.body.stores[0].category}&amountCents=10000`,
        )
        .set("Cookie", cookie);

      expect(recRes.status).toBe(200);
      expect(recRes.body.category).toBe("GROCERIES");
      expect(recRes.body.rankedCards[0].name).toBe("Mint Everyday");
      expect(recRes.body.rankedCards[0].rewardCents).toBe(400); // $4.00
    }
  });

  it("returns matching stores in stable A–Z order and caps results at 10", async () => {
    mockStores = Array.from({ length: 15 }, (_, i) => ({
      id: `s-${i}`,
      name: `Market ${String.fromCharCode(90 - i)}`,
      category: "GROCERIES",
      aliases: [],
    }));
    const cookie = await createAuthCookie("user-1", "priya@example.com");

    const res = await request(app)
      .get("/api/v1/stores/search?q=Market")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.stores).toHaveLength(10);
    const names = res.body.stores.map((s: StoreSearchResult) => s.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
