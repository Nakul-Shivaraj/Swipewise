import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../db.js";
import { DEMO_CARDS, DEMO_PROGRAMS } from "../seed-data.js";
import { getCsrfTokenAndCookie } from "./test-helpers.js";

async function seedCatalogInTestDb() {
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
}

describe("GET /api/v1/recommendations (US-03 / Issue #12)", () => {
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
    const cookie = res.headers["set-cookie"]!;
    return {
      res,
      cookie,
      userId: res.body.user?.id as string,
    };
  }

  beforeEach(async () => {
    await prisma.walletCard.deleteMany();
    await prisma.rewardRule.deleteMany();
    await prisma.card.deleteMany();
    await prisma.rewardsProgram.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rateLimit.deleteMany();
    await seedCatalogInTestDb();
  });

  afterAll(async () => {
    await prisma.walletCard.deleteMany();
    await prisma.rewardRule.deleteMany();
    await prisma.card.deleteMany();
    await prisma.rewardsProgram.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rateLimit.deleteMany();
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get(
      "/api/v1/recommendations?category=GROCERIES",
    );
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when category or amountCents is invalid", async () => {
    const { cookie } = await registerUser("priya@example.com", "Priya Sharma");

    const badCat = await request(app)
      .get("/api/v1/recommendations?category=INVALID")
      .set("Cookie", cookie);
    expect(badCat.status).toBe(400);
    expect(badCat.body.error.code).toBe("VALIDATION_ERROR");

    const zeroAmt = await request(app)
      .get("/api/v1/recommendations?category=GROCERIES&amountCents=0")
      .set("Cookie", cookie);
    expect(zeroAmt.status).toBe(400);

    const overMaxAmt = await request(app)
      .get("/api/v1/recommendations?category=GROCERIES&amountCents=100000001")
      .set("Cookie", cookie);
    expect(overMaxAmt.status).toBe(400);

    const floatAmt = await request(app)
      .get("/api/v1/recommendations?category=GROCERIES&amountCents=100.5")
      .set("Cookie", cookie);
    expect(floatAmt.status).toBe(400);
  });

  it("AC1 & AC2: ranks the logged-in user wallet cards for GROCERIES on $100 (Mint Everyday $4.00, Basic Flat $1.50, Harbor Travel Plus $1.25)", async () => {
    const { cookie, userId } = await registerUser(
      "priya@example.com",
      "Priya Sharma",
    );

    const cards = await prisma.card.findMany();
    for (const card of cards) {
      await prisma.walletCard.create({
        data: {
          userId,
          cardId: card.id,
        },
      });
    }

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

  it("AC3: splits a purchase that crosses a spending cap and applies base rate to the amount over cap", async () => {
    const { cookie, userId } = await registerUser(
      "captester@example.com",
      "Cap Tester",
    );

    const mintCard = await prisma.card.findUniqueOrThrow({
      where: { name: "Mint Everyday" },
    });
    const basicCard = await prisma.card.findUniqueOrThrow({
      where: { name: "Basic Flat" },
    });

    // Set a $200.00 (20000 cents) cap on Mint Everyday GROCERIES rule
    await prisma.rewardRule.update({
      where: {
        cardId_category: {
          cardId: mintCard.id,
          category: "GROCERIES",
        },
      },
      data: {
        capCents: 20000,
      },
    });

    await prisma.walletCard.createMany({
      data: [
        { userId, cardId: mintCard.id },
        { userId, cardId: basicCard.id },
      ],
    });

    // Purchase of $500.00 (50000 cents):
    // Mint Everyday: $200 at 4% (800 cents) + $300 at 1% base (300 cents) = 1100 cents ($11.00)
    // Basic Flat: $500 at 1.5% base = 750 cents ($7.50)
    const res = await request(app)
      .get("/api/v1/recommendations?category=GROCERIES&amountCents=50000")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.rankedCards[0].name).toBe("Mint Everyday");
    expect(res.body.rankedCards[0].rewardCents).toBe(1100);
    expect(res.body.rankedCards[0].isCapExceeded).toBe(true);
    expect(res.body.rankedCards[1].name).toBe("Basic Flat");
    expect(res.body.rankedCards[1].rewardCents).toBe(750);
  });

  it("AC5: returns empty rankedCards with isEmptyWallet=true when wallet is empty, and scopes strictly to logged-in user", async () => {
    // User A has cards
    const { userId: userAId } = await registerUser(
      "usera@example.com",
      "User A",
    );
    const mintCard = await prisma.card.findUniqueOrThrow({
      where: { name: "Mint Everyday" },
    });
    await prisma.walletCard.create({
      data: {
        userId: userAId,
        cardId: mintCard.id,
      },
    });

    // User B has no cards
    const { cookie: userBCookie } = await registerUser(
      "userb@example.com",
      "User B",
    );

    const res = await request(app)
      .get("/api/v1/recommendations?category=GROCERIES")
      .set("Cookie", userBCookie);

    expect(res.status).toBe(200);
    expect(res.body.isEmptyWallet).toBe(true);
    expect(res.body.rankedCards).toEqual([]);
  });
});
