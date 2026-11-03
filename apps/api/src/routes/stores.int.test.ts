import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../db.js";
import { DEMO_CARDS, DEMO_PROGRAMS, DEMO_STORES } from "../seed-data.js";
import { getCsrfTokenAndCookie } from "./test-helpers.js";

async function seedCatalogAndStoresInTestDb() {
  for (const prog of DEMO_PROGRAMS) {
    await prisma.rewardsProgram.upsert({
      where: { name: prog.name },
      update: { centsPer100Points: prog.centsPer100Points },
      create: {
        name: prog.name,
        centsPer100Points: prog.centsPer100Points,
      },
    });
  }

  for (const card of DEMO_CARDS) {
    const program = await prisma.rewardsProgram.findUniqueOrThrow({
      where: { name: card.programName },
    });

    const createdCard = await prisma.card.upsert({
      where: { name: card.name },
      update: {
        issuer: card.issuer,
        artColor: card.artColor,
        isDemo: card.isDemo,
        programId: program.id,
        annualFeeCents: card.annualFeeCents,
        baseRateX100: card.baseRateX100,
      },
      create: {
        name: card.name,
        issuer: card.issuer,
        artColor: card.artColor,
        isDemo: card.isDemo,
        programId: program.id,
        annualFeeCents: card.annualFeeCents,
        baseRateX100: card.baseRateX100,
      },
    });

    for (const rule of card.rules) {
      await prisma.rewardRule.upsert({
        where: {
          cardId_category: {
            cardId: createdCard.id,
            category: rule.category,
          },
        },
        update: {
          rateX100: rule.rateX100,
          capCents: rule.capCents ?? null,
        },
        create: {
          cardId: createdCard.id,
          category: rule.category,
          rateX100: rule.rateX100,
          capCents: rule.capCents ?? null,
        },
      });
    }
  }

  for (const store of DEMO_STORES) {
    const createdStore = await prisma.store.upsert({
      where: { name: store.name },
      update: { category: store.category },
      create: {
        name: store.name,
        category: store.category,
      },
    });

    for (const alias of store.aliases) {
      await prisma.storeAlias.upsert({
        where: {
          storeId_alias: {
            storeId: createdStore.id,
            alias,
          },
        },
        update: {},
        create: {
          storeId: createdStore.id,
          alias,
        },
      });
    }
  }
}

const hasTestDatabase = Boolean(
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
);

describe.skipIf(!hasTestDatabase)(
  "GET /api/v1/stores/search integration tests (US-04 / Issue #13)",
  () => {
    const app = createApp({ prisma, schema: "test", rateLimitMax: 100 });

    async function registerUser(email: string, name: string) {
      const { token: csrfToken, cookie: csrfCookie } =
        await getCsrfTokenAndCookie(app);
      const res = await request(app)
        .post("/api/v1/auth/signup")
        .set("x-csrf-token", csrfToken)
        .set("Cookie", csrfCookie)
        .send({
          name,
          email,
          password: "Password123",
          confirmPassword: "Password123",
        });
      return {
        cookie: res.headers["set-cookie"]!,
        userId: res.body.user?.id as string,
      };
    }

    beforeEach(async () => {
      await prisma.storeAlias.deleteMany();
      await prisma.store.deleteMany();
      await prisma.walletCard.deleteMany();
      await prisma.rewardRule.deleteMany();
      await prisma.card.deleteMany();
      await prisma.rewardsProgram.deleteMany();
      await prisma.user.deleteMany();
      await prisma.rateLimit.deleteMany();
      await seedCatalogAndStoresInTestDb();
    });

    afterAll(async () => {
      await prisma.storeAlias.deleteMany();
      await prisma.store.deleteMany();
      await prisma.walletCard.deleteMany();
      await prisma.rewardRule.deleteMany();
      await prisma.card.deleteMany();
      await prisma.rewardsProgram.deleteMany();
      await prisma.user.deleteMany();
      await prisma.rateLimit.deleteMany();
    });

    it("returns 401 when not authenticated", async () => {
      const res = await request(app).get("/api/v1/stores/search?q=Safeway");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 400 when search query is invalid", async () => {
      const { cookie } = await registerUser(
        "priya-store@example.com",
        "Priya Sharma",
      );

      const emptyRes = await request(app)
        .get("/api/v1/stores/search?q=")
        .set("Cookie", cookie);
      expect(emptyRes.status).toBe(400);
      expect(emptyRes.body.error.code).toBe("VALIDATION_ERROR");

      const longRes = await request(app)
        .get(`/api/v1/stores/search?q=${"x".repeat(101)}`)
        .set("Cookie", cookie);
      expect(longRes.status).toBe(400);
      expect(longRes.body.error.code).toBe("VALIDATION_ERROR");
    });

    it('AC1 & AC2: "SAFEWAY", "safeway", and alias "safeway.com" all find Safeway (GROCERIES) and rank Mint Everyday first at $4.00 on $100 with the 3 demo cards', async () => {
      const { cookie, userId } = await registerUser(
        "priya-safeway@example.com",
        "Priya Sharma",
      );

      const cards = await prisma.card.findMany();
      for (const card of cards) {
        await prisma.walletCard.create({
          data: { userId, cardId: card.id },
        });
      }

      for (const query of ["SAFEWAY", "safeway", "safeway.com"]) {
        const searchRes = await request(app)
          .get(`/api/v1/stores/search?q=${encodeURIComponent(query)}`)
          .set("Cookie", cookie);

        expect(searchRes.status).toBe(200);
        expect(searchRes.body.stores).toHaveLength(1);
        expect(searchRes.body.stores[0].name).toBe("Safeway");
        expect(searchRes.body.stores[0].category).toBe("GROCERIES");

        const recRes = await request(app)
          .get(
            `/api/v1/recommendations?category=${searchRes.body.stores[0].category}&amountCents=10000`,
          )
          .set("Cookie", cookie);

        expect(recRes.status).toBe(200);
        expect(recRes.body.rankedCards[0].name).toBe("Mint Everyday");
        expect(recRes.body.rankedCards[0].rewardCents).toBe(400);
      }
    }, 30000);

    it("seed is idempotent when re-run and returns stores ordered A–Z capped at 10", async () => {
      const initialStoreCount = await prisma.store.count();
      const initialAliasCount = await prisma.storeAlias.count();

      // Re-run seed
      await seedCatalogAndStoresInTestDb();

      expect(await prisma.store.count()).toBe(initialStoreCount);
      expect(await prisma.storeAlias.count()).toBe(initialAliasCount);

      // Add extra stores to test 10-item cap and A–Z ordering
      for (let i = 1; i <= 12; i++) {
        await prisma.store.create({
          data: {
            name: `Alpha Store ${String(i).padStart(2, "0")}`,
            category: "GROCERIES",
          },
        });
      }

      const { cookie } = await registerUser(
        "order@example.com",
        "Order Tester",
      );

      const res = await request(app)
        .get("/api/v1/stores/search?q=Alpha%20Store")
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.stores).toHaveLength(10);
      const names = res.body.stores.map((s: { name: string }) => s.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    }, 30000);
  },
);
