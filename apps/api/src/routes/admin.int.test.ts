import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../db.js";
import { getCsrfTokenAndCookie } from "./test-helpers.js";

interface CardAuditLogRecord {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  createdAt: string;
}

interface WalletCardResponseItem {
  id: string;
  cardId: string;
  card: {
    id: string;
    name: string;
    isRetired?: boolean;
  };
}

describe("Admin Pages & Audit Log Integration (US-10 / Issue #25)", () => {
  const app = createApp({
    prisma,
    schema: "test",
    rateLimitMax: 100,
    generalRateLimitMax: 100,
  });

  let adminCookie = "";
  let regularCookie = "";
  let adminUserId = "";
  let defaultProgramId = "";

  beforeEach(async () => {
    // Clean up DB
    await prisma.auditLog.deleteMany();
    await prisma.spendEntry.deleteMany();
    await prisma.walletCardBonusOffer.deleteMany();
    await prisma.bonusOffer.deleteMany();
    await prisma.perkUsage.deleteMany();
    await prisma.perk.deleteMany();
    await prisma.rewardRule.deleteMany();
    await prisma.rotatingCategory.deleteMany();
    await prisma.walletCardPaidCycle.deleteMany();
    await prisma.walletCardPaymentSetting.deleteMany();
    await prisma.walletCardQuarterActivation.deleteMany();
    await prisma.walletCard.deleteMany();
    await prisma.card.deleteMany();
    await prisma.storeAlias.deleteMany();
    await prisma.store.deleteMany();
    await prisma.rewardsProgram.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rateLimit.deleteMany();

    const program = await prisma.rewardsProgram.create({
      data: {
        name: "Test Points Program",
        centsPer100Points: 100,
      },
    });
    defaultProgramId = program.id;

    // Create Admin user
    const csrfAdmin = await getCsrfTokenAndCookie(app);
    const signupAdmin = await request(app)
      .post("/api/v1/auth/signup")
      .set("x-csrf-token", csrfAdmin.token)
      .set("Cookie", csrfAdmin.cookie)
      .send({
        name: "Admin User",
        email: "admin@swipewise.local",
        password: "AdminPassword123",
        confirmPassword: "AdminPassword123",
      });
    expect(signupAdmin.status).toBe(201);
    adminUserId = signupAdmin.body.user.id;
    adminCookie = signupAdmin.headers["set-cookie"]![0]!;

    // Promote Admin User directly in DB
    await prisma.user.update({
      where: { id: adminUserId },
      data: { role: "ADMIN" },
    });

    // Create Regular user
    const csrfRegular = await getCsrfTokenAndCookie(app);
    const signupRegular = await request(app)
      .post("/api/v1/auth/signup")
      .set("x-csrf-token", csrfRegular.token)
      .set("Cookie", csrfRegular.cookie)
      .send({
        name: "Regular User",
        email: "regular@swipewise.local",
        password: "UserPassword123",
        confirmPassword: "UserPassword123",
      });
    expect(signupRegular.status).toBe(201);
    regularCookie = signupRegular.headers["set-cookie"]![0]!;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("AC4: regular user gets 403 on every admin route", async () => {
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const cookieHeader = `${regularCookie}; ${csrfCookie}`;

    const routes: Array<{
      method: "get" | "post" | "patch";
      path: string;
      body?: Record<string, unknown>;
    }> = [
      { method: "get", path: "/api/v1/admin/cards" },
      { method: "post", path: "/api/v1/admin/cards", body: {} },
      { method: "patch", path: "/api/v1/admin/cards/any-id", body: {} },
      { method: "post", path: "/api/v1/admin/cards/any-id/retire", body: {} },
      { method: "get", path: "/api/v1/admin/stores" },
      { method: "post", path: "/api/v1/admin/stores", body: {} },
      { method: "patch", path: "/api/v1/admin/stores/any-id", body: {} },
      { method: "get", path: "/api/v1/admin/audit-logs" },
    ];

    for (const route of routes) {
      const req = request(app)
        [route.method](route.path)
        .set("Cookie", cookieHeader)
        .set("x-csrf-token", csrfToken);
      const res = route.body ? await req.send(route.body) : await req;

      expect(
        res.status,
        `Expected 403 on ${route.method.toUpperCase()} ${route.path}`,
      ).toBe(403);
      expect(res.body.error?.code).toBe("FORBIDDEN");
      expect(res.body.error?.message).toBe("Admin access required.");
    }
  });

  it("unauthenticated user gets 401 on every admin route", async () => {
    const routes = [
      "/api/v1/admin/cards",
      "/api/v1/admin/stores",
      "/api/v1/admin/audit-logs",
    ];

    for (const path of routes) {
      const res = await request(app).get(path);
      expect(res.status, `Expected 401 on GET ${path}`).toBe(401);
      expect(res.body.error?.code).toBe("UNAUTHORIZED");
    }
  });

  it("AC1 & AC3: admin can add, edit, and retire cards with reward rules, perks, bonus offer, creating exactly one audit log per change", async () => {
    const { token: csrf1, cookie: csrfCookie1 } =
      await getCsrfTokenAndCookie(app);

    // 1. Add card
    const createCardRes = await request(app)
      .post("/api/v1/admin/cards")
      .set("Cookie", `${adminCookie}; ${csrfCookie1}`)
      .set("x-csrf-token", csrf1)
      .send({
        name: "Emerald Horizon Demo",
        issuer: "Horizon Bank",
        artColor: "#2F7D4F",
        isDemo: true,
        annualFeeCents: 9500,
        baseRateX100: 100,
        programId: defaultProgramId,
        rewardRules: [
          { category: "DINING", rateX100: 300, capCents: null },
          { category: "GROCERIES", rateX100: 400, capCents: 600000 },
        ],
        perks: [
          { name: "Dining Credit", amountCents: 1000, period: "MONTHLY" },
        ],
        bonusOffer: {
          spendRequirementCents: 400000,
          windowMonths: 3,
          bonusPoints: 60000,
        },
      });

    expect(createCardRes.status).toBe(201);
    const cardId = createCardRes.body.card.id as string;
    expect(createCardRes.body.card.name).toBe("Emerald Horizon Demo");
    expect(createCardRes.body.card.rewardRules).toHaveLength(2);
    expect(createCardRes.body.card.perks).toHaveLength(1);
    expect(createCardRes.body.card.bonusOffer).toBeDefined();

    // Verify exactly 1 audit entry for creation
    let auditLogsRes = await request(app)
      .get("/api/v1/admin/audit-logs")
      .set("Cookie", adminCookie);
    expect(auditLogsRes.status).toBe(200);
    const auditLogs1 = auditLogsRes.body.auditLogs as CardAuditLogRecord[];
    expect(auditLogs1).toHaveLength(1);
    expect(auditLogs1[0]?.action).toBe("CREATE_CARD");
    expect(auditLogs1[0]?.entityType).toBe("CARD");
    expect(auditLogs1[0]?.entityId).toBe(cardId);
    expect(auditLogs1[0]?.before).toBeNull();
    expect(auditLogs1[0]?.after.name).toBe("Emerald Horizon Demo");

    // 2. Edit card
    const { token: csrf2, cookie: csrfCookie2 } =
      await getCsrfTokenAndCookie(app);
    const updateCardRes = await request(app)
      .patch(`/api/v1/admin/cards/${cardId}`)
      .set("Cookie", `${adminCookie}; ${csrfCookie2}`)
      .set("x-csrf-token", csrf2)
      .send({
        annualFeeCents: 12000,
        baseRateX100: 150,
      });

    expect(updateCardRes.status).toBe(200);
    expect(updateCardRes.body.card.annualFeeCents).toBe(12000);
    expect(updateCardRes.body.card.baseRateX100).toBe(150);

    // Verify exactly 2 audit entries now (1 new)
    auditLogsRes = await request(app)
      .get("/api/v1/admin/audit-logs")
      .set("Cookie", adminCookie);
    const auditLogs2 = auditLogsRes.body.auditLogs as CardAuditLogRecord[];
    expect(auditLogs2).toHaveLength(2);
    const updateLog = auditLogs2[0]; // newest first
    expect(updateLog?.action).toBe("UPDATE_CARD");
    expect(updateLog?.before?.annualFeeCents).toBe(9500);
    expect(updateLog?.after.annualFeeCents).toBe(12000);

    // 3. Retire card
    const { token: csrf3, cookie: csrfCookie3 } =
      await getCsrfTokenAndCookie(app);
    const retireCardRes = await request(app)
      .post(`/api/v1/admin/cards/${cardId}/retire`)
      .set("Cookie", `${adminCookie}; ${csrfCookie3}`)
      .set("x-csrf-token", csrf3)
      .send({});

    expect(retireCardRes.status).toBe(200);
    expect(retireCardRes.body.card.isRetired).toBe(true);

    // Verify exactly 3 audit entries
    auditLogsRes = await request(app)
      .get("/api/v1/admin/audit-logs")
      .set("Cookie", adminCookie);
    const auditLogs3 = auditLogsRes.body.auditLogs as CardAuditLogRecord[];
    expect(auditLogs3).toHaveLength(3);
    const retireLog = auditLogs3[0];
    expect(retireLog?.action).toBe("RETIRE_CARD");
    expect(retireLog?.before?.isRetired).toBe(false);
    expect(retireLog?.after.isRetired).toBe(true);
  });

  it("AC1 & AC3: admin can add and edit stores and aliases with audit log", async () => {
    const { token: csrf1, cookie: csrfCookie1 } =
      await getCsrfTokenAndCookie(app);

    // Create store
    const createStoreRes = await request(app)
      .post("/api/v1/admin/stores")
      .set("Cookie", `${adminCookie}; ${csrfCookie1}`)
      .set("x-csrf-token", csrf1)
      .send({
        name: "Trader Demo Grocery",
        category: "GROCERIES",
        aliases: ["Trader Demo", "TD Grocery"],
      });

    expect(createStoreRes.status).toBe(201);
    const storeId = createStoreRes.body.store.id as string;
    expect(createStoreRes.body.store.aliases).toHaveLength(2);

    // Verify audit log for store creation
    let auditLogsRes = await request(app)
      .get("/api/v1/admin/audit-logs")
      .set("Cookie", adminCookie);
    expect(auditLogsRes.status).toBe(200);
    const auditLogs1 = auditLogsRes.body.auditLogs as CardAuditLogRecord[];
    expect(auditLogs1).toHaveLength(1);
    expect(auditLogs1[0]?.action).toBe("CREATE_STORE");
    expect(auditLogs1[0]?.entityType).toBe("STORE");
    expect(auditLogs1[0]?.entityId).toBe(storeId);

    // Edit store
    const { token: csrf2, cookie: csrfCookie2 } =
      await getCsrfTokenAndCookie(app);
    const updateStoreRes = await request(app)
      .patch(`/api/v1/admin/stores/${storeId}`)
      .set("Cookie", `${adminCookie}; ${csrfCookie2}`)
      .set("x-csrf-token", csrf2)
      .send({
        name: "Trader Demo Market",
        category: "GROCERIES",
        aliases: ["Trader Demo", "TD Grocery", "TD Market"],
      });

    expect(updateStoreRes.status).toBe(200);
    expect(updateStoreRes.body.store.name).toBe("Trader Demo Market");
    expect(updateStoreRes.body.store.aliases).toHaveLength(3);

    // Verify audit log for store update
    auditLogsRes = await request(app)
      .get("/api/v1/admin/audit-logs")
      .set("Cookie", adminCookie);
    const auditLogs2 = auditLogsRes.body.auditLogs as CardAuditLogRecord[];
    expect(auditLogs2).toHaveLength(2);
    expect(auditLogs2[0]?.action).toBe("UPDATE_STORE");
    expect(auditLogs2[0]?.before?.name).toBe("Trader Demo Grocery");
    expect(auditLogs2[0]?.after.name).toBe("Trader Demo Market");
  });

  it("AC2: retired card does not appear in catalog for Add Card, but stays in existing wallets with isRetired: true", async () => {
    // 1. Admin creates a card
    const { token: csrf1, cookie: csrfCookie1 } =
      await getCsrfTokenAndCookie(app);
    const createCardRes = await request(app)
      .post("/api/v1/admin/cards")
      .set("Cookie", `${adminCookie}; ${csrfCookie1}`)
      .set("x-csrf-token", csrf1)
      .send({
        name: "Vintage Cash Demo",
        issuer: "Vintage Bank",
        artColor: "#7454CF",
        isDemo: true,
        annualFeeCents: 0,
        baseRateX100: 100,
        programId: defaultProgramId,
        rewardRules: [],
      });
    const cardId = createCardRes.body.card.id as string;

    // 2. Regular user adds it to their wallet
    const { token: csrf2, cookie: csrfCookie2 } =
      await getCsrfTokenAndCookie(app);
    const addCardRes = await request(app)
      .post("/api/v1/wallet/cards")
      .set("Cookie", `${regularCookie}; ${csrfCookie2}`)
      .set("x-csrf-token", csrf2)
      .send({
        cardId,
        nickname: "My Vintage Card",
      });
    expect(addCardRes.status).toBe(201);

    // 3. Admin retires the card
    const { token: csrf3, cookie: csrfCookie3 } =
      await getCsrfTokenAndCookie(app);
    const retireRes = await request(app)
      .post(`/api/v1/admin/cards/${cardId}/retire`)
      .set("Cookie", `${adminCookie}; ${csrfCookie3}`)
      .set("x-csrf-token", csrf3)
      .send({});
    expect(retireRes.status).toBe(200);

    // 4. Catalog cards list (Add card) does NOT include the retired card
    const catalogRes = await request(app)
      .get("/api/v1/catalog/cards")
      .set("Cookie", regularCookie);
    expect(catalogRes.status).toBe(200);
    const cards = catalogRes.body.cards as Array<{ id: string }>;
    const foundInCatalog = cards.find((c) => c.id === cardId);
    expect(foundInCatalog).toBeUndefined();

    // 5. User wallet cards list STILL includes the card with isRetired: true
    const walletRes = await request(app)
      .get("/api/v1/wallet/cards")
      .set("Cookie", regularCookie);
    expect(walletRes.status).toBe(200);
    const walletCards = walletRes.body.walletCards as WalletCardResponseItem[];
    const walletCard = walletCards.find((wc) => wc.cardId === cardId);
    expect(walletCard).toBeDefined();
    expect(walletCard?.card.isRetired).toBe(true);
  });

  it("rejects card numbers in card and store text fields", async () => {
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const cookieHeader = `${adminCookie}; ${csrfCookie}`;

    // Card name has Luhn card number
    const resCard = await request(app)
      .post("/api/v1/admin/cards")
      .set("Cookie", cookieHeader)
      .set("x-csrf-token", csrfToken)
      .send({
        name: "4111111111111111",
        issuer: "Demo Bank",
        artColor: "#1a365d",
        annualFeeCents: 0,
        baseRateX100: 100,
        programId: defaultProgramId,
        rewardRules: [],
      });
    expect(resCard.status).toBe(400);
    expect(resCard.body.error?.message).toContain("Don't enter card numbers");

    // Store alias has Luhn card number
    const resStore = await request(app)
      .post("/api/v1/admin/stores")
      .set("Cookie", cookieHeader)
      .set("x-csrf-token", csrfToken)
      .send({
        name: "Safe Store",
        category: "GROCERIES",
        aliases: ["4111111111111111"],
      });
    expect(resStore.status).toBe(400);
    expect(resStore.body.error?.message).toContain("Don't enter card numbers");
  });
});
