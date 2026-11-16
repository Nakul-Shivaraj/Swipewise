import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { createApp } from "../app.js";
import { getJwtSecret } from "../middleware/auth.middleware.js";
import { CatalogCardItem } from "../repositories/catalog.repository.js";
import { DEMO_CARDS, DEMO_PROGRAMS, DEMO_STORES } from "../seed-data.js";
import { StoreSearchResult } from "@swipewise/shared";
import { generateOpenApiSpec } from "../public/openapi-generator.js";

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

describe("Public API & OpenAPI Specification (#50)", () => {
  const fixedNow = new Date("2026-11-15T12:00:00.000Z");
  const rateHits = new Map<string, { hits: number; resetTime: Date }>();
  let mockCatalogCards: CatalogCardItem[] = [];
  let mockStores: StoreSearchResult[] = [];

  const fakePrisma = {
    $executeRawUnsafe: async () => 0,
    $queryRaw: async () => [{ "?column?": 1 }],
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
    rateHits.clear();
    mockCatalogCards = buildMockCatalogCards();
    mockStores = buildMockStores();

    app.set("catalogRepo", {
      findAllCards: async () => mockCatalogCards,
      findCardById: async (id: string) =>
        mockCatalogCards.find((c) => c.id === id) ?? null,
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

  describe("AC1: All 4 public endpoints work without login and return no user data", () => {
    it("GET /api/public/v1/cards returns catalog cards with name, issuer, annualFee, baseRate, and reward rules", async () => {
      const res = await request(app).get("/api/public/v1/cards");
      expect(res.status).toBe(200);
      expect(res.body.cards).toBeInstanceOf(Array);
      expect(res.body.cards.length).toBe(mockCatalogCards.length);

      const firstCard = res.body.cards[0];
      expect(firstCard).toHaveProperty("name");
      expect(firstCard).toHaveProperty("issuer");
      expect(firstCard).toHaveProperty("annualFeeCents");
      expect(firstCard).toHaveProperty("baseRateX100");
      expect(firstCard.rates || firstCard.rewardRules).toBeDefined();

      // Must never return user-specific fields
      expect(firstCard).not.toHaveProperty("walletCardId");
      expect(firstCard).not.toHaveProperty("nickname");
      expect(firstCard).not.toHaveProperty("userId");
    });

    it("GET /api/public/v1/categories returns the list of categories", async () => {
      const res = await request(app).get("/api/public/v1/categories");
      expect(res.status).toBe(200);
      expect(res.body.categories).toEqual([
        "GROCERIES",
        "DINING",
        "GAS",
        "TRAVEL",
      ]);
    });

    it("GET /api/public/v1/stores?query=saf returns matching stores and their category", async () => {
      const res = await request(app).get("/api/public/v1/stores?query=saf");
      expect(res.status).toBe(200);
      expect(res.body.stores).toBeInstanceOf(Array);
      expect(res.body.stores.length).toBeGreaterThan(0);
      expect(res.body.stores[0].name).toBe("Safeway");
      expect(res.body.stores[0].category).toBe("GROCERIES");
      expect(res.body.stores[0]).not.toHaveProperty("userId");
    });

    it("GET /api/public/v1/best-card?category=GROCERIES&amountCents=10000 ranks catalog cards by reward", async () => {
      const res = await request(app).get(
        "/api/public/v1/best-card?category=GROCERIES&amountCents=10000",
      );
      expect(res.status).toBe(200);
      expect(res.body.category).toBe("GROCERIES");
      expect(res.body.amountCents).toBe(10000);
      expect(res.body.bestCard).toBeDefined();
      expect(res.body.bestCard.name).toBe("Mint Everyday");
      expect(res.body.bestCard.rewardCents).toBe(400);
      expect(res.body.bestCard.isBestPick).toBe(true);
      expect(res.body.rankedCards).toBeInstanceOf(Array);
      expect(res.body.rankedCards.length).toBe(mockCatalogCards.length);
      expect(res.body.rankedCards[0]).not.toHaveProperty("walletCardId");
      expect(res.body.rankedCards[0]).not.toHaveProperty("nickname");
    });

    it("GET /api/public/v1/best-card filters by optional cardIds", async () => {
      const targetCardId = mockCatalogCards[0].id;
      const res = await request(app).get(
        `/api/public/v1/best-card?category=GROCERIES&amountCents=10000&cardIds=${targetCardId}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.rankedCards).toHaveLength(1);
      expect(res.body.rankedCards[0].cardId).toBe(targetCardId);
      expect(res.body.bestCard.cardId).toBe(targetCardId);
    });

    it("ignores user auth cookies completely and never touches user records", async () => {
      const authCookie = await createAuthCookie(
        "99999999-9999-4999-8999-999999999999",
        "secret-user@example.com",
      );

      app.set("walletRepo", {
        findWalletCardsByUserId: async () => {
          throw new Error("Must not touch walletRepo");
        },
      });

      const endpoints = [
        "/api/public/v1/cards",
        "/api/public/v1/categories",
        "/api/public/v1/stores?query=saf",
        "/api/public/v1/best-card?category=GAS&amountCents=10000",
      ];

      for (const endpoint of endpoints) {
        rateHits.clear();
        const res = await request(app).get(endpoint).set("Cookie", authCookie);
        expect(res.status).toBe(200);
        const serialized = JSON.stringify(res.body);
        expect(serialized).not.toContain(
          "99999999-9999-4999-8999-999999999999",
        );
        expect(serialized).not.toContain("secret-user@example.com");
      }
    });

    it("rejects Luhn-valid card numbers in query parameters with 400", async () => {
      const cardNumber = "4111 1111 1111 1111";
      const badUrls = [
        `/api/public/v1/cards?q=${encodeURIComponent(cardNumber)}`,
        `/api/public/v1/categories?q=${encodeURIComponent(cardNumber)}`,
        `/api/public/v1/stores?query=${encodeURIComponent(cardNumber)}`,
        `/api/public/v1/best-card?category=GROCERIES&amountCents=${encodeURIComponent(cardNumber)}`,
      ];

      for (const url of badUrls) {
        rateHits.clear();
        const res = await request(app).get(url);
        expect(res.status, `Expected 400 for ${url}`).toBe(400);
        expect(res.body.error?.code).toBe("VALIDATION_ERROR");
        expect(JSON.stringify(res.body)).not.toContain("4111");
      }
    });
  });

  describe("AC2: Rate limit returns 429 after the limit", () => {
    it("returns 429 when public rate limit is exceeded, without locking out authenticated routes", async () => {
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
          name: "Test User",
          email: "test@example.com",
          passwordHash: "hash",
          timeZone: "America/Los_Angeles",
          createdAt: fixedNow,
          updatedAt: fixedNow,
        }),
      });

      expect(
        (await request(limitedApp).get("/api/public/v1/categories")).status,
      ).toBe(200);
      expect(
        (await request(limitedApp).get("/api/public/v1/categories")).status,
      ).toBe(200);
      const third = await request(limitedApp).get("/api/public/v1/categories");
      expect(third.status).toBe(429);
      expect(third.body.error?.code).toBe("RATE_LIMIT_EXCEEDED");

      // App user route still works
      const authCookie = await createAuthCookie(
        "12345678-1234-4234-8234-123456789012",
        "test@example.com",
      );
      const meRes = await request(limitedApp)
        .get("/api/v1/auth/me")
        .set("Cookie", authCookie);
      expect(meRes.status).toBe(200);
    });

    it("uses client IP from X-Forwarded-For so two different IPs get separate rate limits behind a proxy", async () => {
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
        nowProvider: () => fixedNow,
      });

      limitedApp.set("catalogRepo", {
        findAllCards: async () => mockCatalogCards,
      });

      const ipA = "203.0.113.195";
      const ipB = "198.51.100.42";

      // IP A exhausts its limit
      const resA1 = await request(limitedApp)
        .get("/api/public/v1/categories")
        .set("X-Forwarded-For", ipA);
      expect(resA1.status).toBe(200);

      const resA2 = await request(limitedApp)
        .get("/api/public/v1/categories")
        .set("X-Forwarded-For", ipA);
      expect(resA2.status).toBe(200);

      const resA3 = await request(limitedApp)
        .get("/api/public/v1/categories")
        .set("X-Forwarded-For", ipA);
      expect(resA3.status).toBe(429);
      expect(resA3.body.error?.code).toBe("RATE_LIMIT_EXCEEDED");

      // IP B still has its full limit available
      const resB1 = await request(limitedApp)
        .get("/api/public/v1/categories")
        .set("X-Forwarded-For", ipB);
      expect(resB1.status).toBe(200);

      const resB2 = await request(limitedApp)
        .get("/api/public/v1/categories")
        .set("X-Forwarded-For", ipB);
      expect(resB2.status).toBe(200);
    });
  });

  describe("AC3: CORS works for /api/public/* only", () => {
    it("allows any origin for /api/public/* routes", async () => {
      const res = await request(app)
        .get("/api/public/v1/cards")
        .set("Origin", "https://untrusted-external-site.com");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("*");
    });

    it("handles CORS preflight for /api/public/* routes", async () => {
      const res = await request(app)
        .options("/api/public/v1/cards")
        .set("Origin", "https://untrusted-external-site.com")
        .set("Access-Control-Request-Method", "GET");

      expect([200, 204]).toContain(res.status);
      expect(res.headers["access-control-allow-origin"]).toBe("*");
    });

    it("does not allow arbitrary origins for internal /api/v1 routes", async () => {
      const res = await request(app)
        .get("/api/v1/health")
        .set("Origin", "https://untrusted-external-site.com");

      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });

  describe("AC4: Swagger UI loads and OpenAPI spec is served", () => {
    it("serves Swagger UI at /api/docs", async () => {
      const res = await request(app).get("/api/docs/");
      expect(res.status).toBe(200);
      expect(res.text).toContain("swagger-ui");
    });

    it("enforces Content Security Policy on the rest of the app while allowing Swagger UI at /api/docs", async () => {
      const docsRes = await request(app).get("/api/docs/");
      expect(docsRes.status).toBe(200);
      expect(docsRes.headers["content-security-policy"]).toBeUndefined();

      const healthRes = await request(app).get("/api/health");
      expect(healthRes.status).toBe(200);
      expect(healthRes.headers["content-security-policy"]).toBeDefined();
      expect(healthRes.headers["content-security-policy"]).toContain(
        "default-src 'self'",
      );
    });

    it("serves OpenAPI JSON specification at /api/openapi.json", async () => {
      const res = await request(app).get("/api/openapi.json");
      expect(res.status).toBe(200);
      expect(res.body.openapi).toMatch(/^3\.0\./);
      expect(res.body.paths).toHaveProperty("/api/public/v1/cards");
      expect(res.body.paths).toHaveProperty("/api/public/v1/categories");
      expect(res.body.paths).toHaveProperty("/api/public/v1/stores");
      expect(res.body.paths).toHaveProperty("/api/public/v1/best-card");
      expect(res.body.paths).toHaveProperty("/api/v1/auth/signup");
      expect(res.body.paths).toHaveProperty("/api/v1/auth/login");
    });
  });

  describe("AC5: A test fails if committed docs/api/openapi.yaml is out of date", () => {
    it("matches the generated OpenAPI spec exactly", () => {
      const spec = generateOpenApiSpec();
      const yamlString = yaml.stringify(spec);

      const filePath = path.resolve(process.cwd(), "docs/api/openapi.yaml");
      expect(fs.existsSync(filePath), "docs/api/openapi.yaml must exist").toBe(
        true,
      );

      const committedContent = fs.readFileSync(filePath, "utf-8");
      expect(
        committedContent.trim(),
        "docs/api/openapi.yaml is out of date. Update it to match generateOpenApiSpec().",
      ).toBe(yamlString.trim());
    });
  });
});
