import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../db.js";
import { DEMO_CARDS, DEMO_PROGRAMS } from "../seed-data.js";

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

describe("Wallet API (US-02 / Issue #11)", () => {
  const app = createApp({ prisma, schema: "test", rateLimitMax: 100 });

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

  async function registerUser(email: string, name: string) {
    const res = await request(app).post("/api/v1/auth/signup").send({
      name,
      email,
      password: "Password123",
      confirmPassword: "Password123",
    });
    return res.headers["set-cookie"]!;
  }

  describe("GET /api/v1/catalog/cards", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await request(app).get("/api/v1/catalog/cards");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns catalog cards with name, issuer, artColor, rates", async () => {
      const cookie = await registerUser("catalog@example.com", "Catalog User");
      const res = await request(app)
        .get("/api/v1/catalog/cards")
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.cards)).toBe(true);
      expect(res.body.cards.length).toBe(3);

      const mintCard = res.body.cards.find(
        (c: { name: string }) => c.name === "Mint Everyday",
      );
      expect(mintCard).toBeDefined();
      expect(mintCard.issuer).toBe("Demo Bank");
      expect(mintCard.artColor).toBe("#2F8C55");
      expect(Array.isArray(mintCard.rates)).toBe(true);
      expect(
        mintCard.rates.some(
          (r: { category: string }) => r.category === "GROCERIES",
        ),
      ).toBe(true);
    });
  });

  describe("POST /api/v1/wallet/cards", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await request(app).post("/api/v1/wallet/cards").send({
        cardId: "00000000-0000-0000-0000-000000000000",
      });
      expect(res.status).toBe(401);
    });

    it("AC1: adds a card from catalog with optional nickname and open date", async () => {
      const cookie = await registerUser("addcard@example.com", "Add Card User");
      const mintCard = await prisma.card.findUniqueOrThrow({
        where: { name: "Mint Everyday" },
      });

      const res = await request(app)
        .post("/api/v1/wallet/cards")
        .set("Cookie", cookie)
        .send({
          cardId: mintCard.id,
          nickname: "My Grocery Card",
          openedDate: "2024-05-01",
        });

      expect(res.status).toBe(201);
      expect(res.body.walletCard.nickname).toBe("My Grocery Card");
      expect(res.body.walletCard.cardId).toBe(mintCard.id);
      expect(res.body.walletCard.card.name).toBe("Mint Everyday");
      expect(res.body.walletCard.openedDate).toMatch(/2024-05-01/);
    });

    it("AC3: rejects nickname that contains a credit card number", async () => {
      const cookie = await registerUser("luhncheck@example.com", "Luhn User");
      const mintCard = await prisma.card.findUniqueOrThrow({
        where: { name: "Mint Everyday" },
      });

      const res = await request(app)
        .post("/api/v1/wallet/cards")
        .set("Cookie", cookie)
        .send({
          cardId: mintCard.id,
          nickname: "Visa 4111111111111111",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("Don't enter card numbers");
    });

    it("returns 404 when cardId does not exist in catalog", async () => {
      const cookie = await registerUser(
        "notfound@example.com",
        "NotFound User",
      );
      const res = await request(app)
        .post("/api/v1/wallet/cards")
        .set("Cookie", cookie)
        .send({
          cardId: "11111111-2222-3333-4444-555555555555",
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("CARD_NOT_FOUND");
    });
  });

  describe("GET /api/v1/wallet/cards", () => {
    it("returns empty array when user has no cards", async () => {
      const cookie = await registerUser("empty@example.com", "Empty User");
      const res = await request(app)
        .get("/api/v1/wallet/cards")
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.walletCards).toEqual([]);
    });

    it("returns user cards with newest on top", async () => {
      const cookie = await registerUser("order@example.com", "Order User");
      const mintCard = await prisma.card.findUniqueOrThrow({
        where: { name: "Mint Everyday" },
      });
      const travelCard = await prisma.card.findUniqueOrThrow({
        where: { name: "Harbor Travel Plus" },
      });

      await request(app)
        .post("/api/v1/wallet/cards")
        .set("Cookie", cookie)
        .send({ cardId: mintCard.id, nickname: "First Card" });

      await new Promise((r) => setTimeout(r, 20));

      await request(app)
        .post("/api/v1/wallet/cards")
        .set("Cookie", cookie)
        .send({ cardId: travelCard.id, nickname: "Second Card" });

      const res = await request(app)
        .get("/api/v1/wallet/cards")
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.walletCards.length).toBe(2);
      expect(res.body.walletCards[0].nickname).toBe("Second Card");
      expect(res.body.walletCards[1].nickname).toBe("First Card");
    });
  });

  describe("PATCH /api/v1/wallet/cards/:id", () => {
    it("AC2: renames a wallet card", async () => {
      const cookie = await registerUser("rename@example.com", "Rename User");
      const mintCard = await prisma.card.findUniqueOrThrow({
        where: { name: "Mint Everyday" },
      });

      const addRes = await request(app)
        .post("/api/v1/wallet/cards")
        .set("Cookie", cookie)
        .send({ cardId: mintCard.id, nickname: "Original" });

      const walletCardId = addRes.body.walletCard.id;

      const patchRes = await request(app)
        .patch(`/api/v1/wallet/cards/${walletCardId}`)
        .set("Cookie", cookie)
        .send({ nickname: "Renamed" });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.walletCard.nickname).toBe("Renamed");
    });

    it("AC3: rejects card numbers in rename request", async () => {
      const cookie = await registerUser("patchluhn@example.com", "Patch Luhn");
      const mintCard = await prisma.card.findUniqueOrThrow({
        where: { name: "Mint Everyday" },
      });

      const addRes = await request(app)
        .post("/api/v1/wallet/cards")
        .set("Cookie", cookie)
        .send({ cardId: mintCard.id });

      const walletCardId = addRes.body.walletCard.id;

      const patchRes = await request(app)
        .patch(`/api/v1/wallet/cards/${walletCardId}`)
        .set("Cookie", cookie)
        .send({ nickname: "4111 1111 1111 1111" });

      expect(patchRes.status).toBe(400);
      expect(patchRes.body.error.message).toContain("Don't enter card numbers");
    });
  });

  describe("DELETE /api/v1/wallet/cards/:id", () => {
    it("AC2: removes a card from user's wallet", async () => {
      const cookie = await registerUser("remove@example.com", "Remove User");
      const mintCard = await prisma.card.findUniqueOrThrow({
        where: { name: "Mint Everyday" },
      });

      const addRes = await request(app)
        .post("/api/v1/wallet/cards")
        .set("Cookie", cookie)
        .send({ cardId: mintCard.id });

      const walletCardId = addRes.body.walletCard.id;

      const delRes = await request(app)
        .delete(`/api/v1/wallet/cards/${walletCardId}`)
        .set("Cookie", cookie);

      expect(delRes.status).toBe(200);

      const listRes = await request(app)
        .get("/api/v1/wallet/cards")
        .set("Cookie", cookie);
      expect(listRes.body.walletCards).toEqual([]);
    });
  });

  describe("AC6: Multi-tenant Isolation", () => {
    it("User A cannot read, change, or delete User B's wallet cards (returns 404)", async () => {
      const userACookie = await registerUser("usera@example.com", "User A");
      const userBCookie = await registerUser("userb@example.com", "User B");

      const mintCard = await prisma.card.findUniqueOrThrow({
        where: { name: "Mint Everyday" },
      });

      // User B adds a card to User B's wallet
      const addRes = await request(app)
        .post("/api/v1/wallet/cards")
        .set("Cookie", userBCookie)
        .send({ cardId: mintCard.id, nickname: "User B Private Card" });

      const userBWalletCardId = addRes.body.walletCard.id;

      // 1. User A lists cards -> does NOT see User B's card
      const listRes = await request(app)
        .get("/api/v1/wallet/cards")
        .set("Cookie", userACookie);
      expect(listRes.status).toBe(200);
      expect(listRes.body.walletCards).toHaveLength(0);

      // 2. User A attempts to PATCH User B's card -> 404
      const patchRes = await request(app)
        .patch(`/api/v1/wallet/cards/${userBWalletCardId}`)
        .set("Cookie", userACookie)
        .send({ nickname: "Hacked Nickname" });
      expect(patchRes.status).toBe(404);
      expect(patchRes.body.error.code).toBe("NOT_FOUND");

      // 3. User A attempts to DELETE User B's card -> 404
      const deleteRes = await request(app)
        .delete(`/api/v1/wallet/cards/${userBWalletCardId}`)
        .set("Cookie", userACookie);
      expect(deleteRes.status).toBe(404);
      expect(deleteRes.body.error.code).toBe("NOT_FOUND");

      // Verify User B's card is unchanged and still in User B's wallet
      const verifyRes = await request(app)
        .get("/api/v1/wallet/cards")
        .set("Cookie", userBCookie);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.walletCards).toHaveLength(1);
      expect(verifyRes.body.walletCards[0].id).toBe(userBWalletCardId);
      expect(verifyRes.body.walletCards[0].nickname).toBe(
        "User B Private Card",
      );
    });
  });
});
