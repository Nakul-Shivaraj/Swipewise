import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";
import type { Express } from "express";
import { StoreSearchResult } from "@swipewise/shared";
import { createApp } from "../app.js";
import { getJwtSecret } from "../middleware/auth.middleware.js";
import { CatalogCardItem } from "../repositories/catalog.repository.js";
import { DEMO_CARDS, DEMO_PROGRAMS, DEMO_STORES } from "../seed-data.js";

function buildMockCatalogCards(): CatalogCardItem[] {
  const baseCards: CatalogCardItem[] = DEMO_CARDS.map((seedCard, idx) => {
    const program = DEMO_PROGRAMS.find((p) => p.name === seedCard.programName)!;
    return {
      id: `00000000-0000-4000-8000-${String(idx + 1).padStart(12, "0")}`,
      name: seedCard.name,
      issuer: seedCard.issuer,
      artColor: seedCard.artColor,
      isDemo: seedCard.isDemo,
      annualFeeCents: seedCard.annualFeeCents,
      baseRateX100: seedCard.baseRateX100,
      program: {
        name: program.name,
        centsPer100Points: program.centsPer100Points,
      },
      rates: seedCard.rules.map((r) => ({
        category: r.category,
        rateX100: r.rateX100,
        capCents: r.capCents ?? null,
      })),
      rotatingCategories: [],
    };
  });

  baseCards.push({
    id: "00000000-0000-4000-8000-000000000099",
    name: "Orbit Quarterly",
    issuer: "Demo Bank",
    artColor: "#6C5CE7",
    isDemo: true,
    annualFeeCents: 0,
    baseRateX100: 100,
    program: {
      name: "Meadow Rewards",
      centsPer100Points: 100,
    },
    rates: [],
    rotatingCategories: [
      {
        quarter: "2026-Q4",
        category: "GAS",
        rateX100: 500,
        capCents: 150000,
      },
    ],
  });

  return baseCards;
}

function buildMockStores(): StoreSearchResult[] {
  return DEMO_STORES.map((store, idx) => ({
    id: `00000000-0000-4000-8000-${String(idx + 101).padStart(12, "0")}`,
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

interface RouterLayer {
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
  };
  handle?: {
    stack?: RouterLayer[];
  };
}

function extractPublicRoutes(app: Express): Array<{
  method: string;
  path: string;
}> {
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
  const routes: Array<{ method: string; path: string }> = [];

  function walk(layers: RouterLayer[]) {
    for (const layer of layers) {
      if (layer.route?.path && layer.route.methods) {
        const routePath = layer.route.path;
        if (routePath.startsWith("/api/v1/public")) {
          for (const [method, enabled] of Object.entries(layer.route.methods)) {
            if (enabled) {
              routes.push({
                method: method.toLowerCase(),
                path: routePath,
              });
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
  return routes;
}

describe("Public API & OpenAPI Docs (US-11 / Issue #26)", () => {
  const fixedNow = new Date("2026-11-15T12:00:00.000Z"); // 2026-Q4 in UTC
  let rateHits = new Map<string, { hits: number; resetTime: Date }>();
  let mockCatalogCards: CatalogCardItem[] = [];
  let mockStores: StoreSearchResult[] = [];

  const fakePrisma = {
    $executeRawUnsafe: async () => 0,
    $queryRawUnsafe: async (_sql: string, key: string, resetTime: Date) => {
      const entry = rateHits.get(key) ?? { hits: 0, resetTime };
      entry.hits += 1;
      rateHits.set(key, entry);
      return [{ total_hits: entry.hits, reset_time: entry.resetTime }];
    },
  } as unknown as NonNullable<Parameters<typeof createApp>[0]>["prisma"];

  const app = createApp({
    prisma: fakePrisma,
    nowProvider: () => fixedNow,
  });

  beforeEach(() => {
    rateHits = new Map();
    mockCatalogCards = buildMockCatalogCards();
    mockStores = buildMockStores();

    app.set("catalogRepo", {
      findAllCards: async () => mockCatalogCards,
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

  it("AC1: GET /api/v1/public/cards returns non-retired catalog cards without authentication", async () => {
    const res = await request(app).get("/api/v1/public/cards");

    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(mockCatalogCards.length);
    expect(res.body.cards[0]).toHaveProperty("id");
    expect(res.body.cards[0]).toHaveProperty("name");
    expect(res.body.cards[0]).toHaveProperty("program");
    expect(res.body.cards[0]).toHaveProperty("rates");
    expect(res.body.cards[0]).not.toHaveProperty("walletCardId");
    expect(res.body.cards[0]).not.toHaveProperty("nickname");
  });

  it("AC1: GET /api/v1/public/recommendations ranks catalog cards for a category in integer cents and returns bestCard + rankedCards", async () => {
    const res = await request(app).get(
      "/api/v1/public/recommendations?category=GROCERIES&amountCents=10000",
    );

    expect(res.status).toBe(200);
    expect(res.body.category).toBe("GROCERIES");
    expect(res.body.amountCents).toBe(10000);
    expect(res.body.bestCard).toBeDefined();
    expect(res.body.bestCard.name).toBe("Mint Everyday");
    expect(res.body.bestCard.rewardCents).toBe(400);
    expect(res.body.bestCard.isBestPick).toBe(true);
    expect(res.body.rankedCards).toHaveLength(mockCatalogCards.length);
    expect(res.body.rankedCards[0]).toEqual(res.body.bestCard);
    expect(res.body.rankedCards[0]).not.toHaveProperty("walletCardId");
    expect(res.body.rankedCards[0]).not.toHaveProperty("nickname");
  });

  it("AC1: GET /api/v1/public/recommendations ranks Orbit Quarterly with no user at base rate with 'Activate to earn 5%' note in UTC quarter", async () => {
    const res = await request(app).get(
      "/api/v1/public/recommendations?category=GAS&amountCents=10000",
    );

    expect(res.status).toBe(200);
    const orbit = res.body.rankedCards.find(
      (c: { name: string }) => c.name === "Orbit Quarterly",
    );
    expect(orbit).toBeDefined();
    expect(orbit.usedBaseRate).toBe(true);
    expect(orbit.appliedRateX100).toBe(100);
    expect(orbit.rewardCents).toBe(100);
    expect(orbit.activationNote).toBe("Activate to earn 5%");
  });

  it("AC1: GET /api/v1/public/stores/search reuses store search without authentication", async () => {
    const res = await request(app).get(
      "/api/v1/public/stores/search?q=safeway.com",
    );

    expect(res.status).toBe(200);
    expect(res.body.stores).toHaveLength(1);
    expect(res.body.stores[0].name).toBe("Safeway");
    expect(res.body.stores[0].category).toBe("GROCERIES");
  });

  it("AC2: ignores session cookies and never touches or returns user wallet data even when called with User A's cookie", async () => {
    const userACookie = await createAuthCookie(
      "11111111-1111-4111-8111-111111111111",
      "user-a@example.com",
    );

    // Configure wallet/recommendation repos that would fail or return User A data if called
    app.set("walletRepo", {
      findWalletCardsByUserId: async () => {
        throw new Error("Public API must never query walletRepo");
      },
    });
    app.set("recommendationRepo", {
      findWalletCardsByUserId: async () => {
        throw new Error("Public API must never query recommendationRepo");
      },
    });

    for (const url of [
      "/api/v1/public/cards",
      "/api/v1/public/recommendations?category=GAS&amountCents=10000",
      "/api/v1/public/stores/search?q=Safeway",
      "/api/v1/public/openapi.json",
    ]) {
      rateHits.clear();
      const res = await request(app).get(url).set("Cookie", userACookie);
      expect(res.status, `GET ${url} with cookie`).toBe(200);
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain("11111111-1111-4111-8111-111111111111");
      expect(serialized).not.toContain("user-a@example.com");
      expect(serialized).not.toContain("walletCardId");
    }
  });

  it("AC2: rejects card-number-like input with 400 across all 4 public endpoints", async () => {
    const cardNumber = "4111 1111 1111 1111";
    const urls = [
      `/api/v1/public/cards?q=${encodeURIComponent(cardNumber)}`,
      `/api/v1/public/recommendations?category=${encodeURIComponent(cardNumber)}`,
      `/api/v1/public/recommendations?category=DINING&amountCents=${encodeURIComponent(cardNumber)}`,
      `/api/v1/public/stores/search?q=${encodeURIComponent(cardNumber)}`,
      `/api/v1/public/openapi.json?q=${encodeURIComponent(cardNumber)}`,
    ];

    for (const url of urls) {
      rateHits.clear();
      const res = await request(app).get(url);
      expect(res.status, `Expected 400 for ${url}`).toBe(400);
      expect(res.body.error?.code).toBe("VALIDATION_ERROR");
      expect(JSON.stringify(res.body)).not.toContain("4111");
    }
  });

  it("AC2: rate-limits /api/v1/public/* with 429 after publicRateLimitMax without locking out logged-in app routes", async () => {
    const localHits = new Map<string, { hits: number; resetTime: Date }>();
    const localPrisma = {
      $executeRawUnsafe: async () => 0,
      $queryRawUnsafe: async (_sql: string, key: string, resetTime: Date) => {
        const entry = localHits.get(key) ?? { hits: 0, resetTime };
        entry.hits += 1;
        localHits.set(key, entry);
        return [{ total_hits: entry.hits, reset_time: entry.resetTime }];
      },
    } as unknown as NonNullable<Parameters<typeof createApp>[0]>["prisma"];

    const limitedApp = createApp({
      prisma: localPrisma,
      publicRateLimitMax: 2,
      generalRateLimitMax: 10,
      nowProvider: () => fixedNow,
    });
    limitedApp.set("catalogRepo", {
      findAllCards: async () => mockCatalogCards,
    });
    limitedApp.set("storeRepo", {
      searchStores: async () => mockStores.slice(0, 1),
    });
    limitedApp.set("userRepo", {
      findById: async (id: string) => ({
        id,
        name: "App User",
        email: "app-user@example.com",
        passwordHash: "hash",
        timeZone: "America/Los_Angeles",
        createdAt: fixedNow,
        updatedAt: fixedNow,
      }),
    });

    const publicUrls = [
      "/api/v1/public/cards",
      "/api/v1/public/recommendations?category=DINING",
      "/api/v1/public/stores/search?q=Safeway",
      "/api/v1/public/openapi.json",
    ];

    for (const url of publicUrls) {
      localHits.clear();
      expect((await request(limitedApp).get(url)).status).toBe(200);
      expect((await request(limitedApp).get(url)).status).toBe(200);
      const third = await request(limitedApp).get(url);
      expect(third.status, `Expected 429 on 3rd call to ${url}`).toBe(429);
      expect(third.body.error?.code).toBe("RATE_LIMIT_EXCEEDED");
    }

    // Logged-in app user is NOT locked out even when public limiter is exhausted
    const authCookie = await createAuthCookie(
      "22222222-2222-4222-8222-222222222222",
      "app-user@example.com",
    );
    const meRes = await request(limitedApp)
      .get("/api/v1/auth/me")
      .set("Cookie", authCookie);
    expect(meRes.status).toBe(200);
    expect(Array.from(localHits.keys())).toContain("public:::ffff:127.0.0.1");
    expect(Array.from(localHits.keys())).toContain("general:::ffff:127.0.0.1");
  });

  it("AC3: GET /api/v1/public/openapi.json serves an OpenAPI 3 document and documents every Express route under /api/v1/public", async () => {
    const res = await request(app).get("/api/v1/public/openapi.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\.0\./);
    expect(res.body.info?.title).toBeDefined();
    expect(res.body.paths).toBeDefined();

    const expressPublicRoutes = extractPublicRoutes(app);
    expect(expressPublicRoutes.length).toBeGreaterThanOrEqual(4);

    for (const route of expressPublicRoutes) {
      const pathItem = res.body.paths[route.path];
      expect(
        pathItem,
        `Missing OpenAPI path entry for ${route.path}`,
      ).toBeDefined();
      expect(
        pathItem[route.method],
        `Missing OpenAPI ${route.method.toUpperCase()} operation for ${route.path}`,
      ).toBeDefined();
    }
  });
});
