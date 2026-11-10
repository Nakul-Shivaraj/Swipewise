import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../db.js";
import { createReminderGeneratorRegistry } from "../domain/reminders.js";
import { createPointsExpiryReminderGenerator } from "../domain/points-expiry.js";
import { PointsBalanceRepository } from "../repositories/points-balance.repository.js";
import { getCsrfTokenAndCookie } from "./test-helpers.js";

describe("Points Balances & Expiry Alerts Integration (US-09 / Issue #24)", () => {
  const TEST_CRON_SECRET = "int-test-cron-secret-24";
  let currentNow = new Date("2026-12-01T18:00:00.000Z"); // 2026-12-01 in America/Los_Angeles
  const registry = createReminderGeneratorRegistry();
  const pointsRepo = new PointsBalanceRepository(prisma);

  const app = createApp({
    prisma,
    schema: "test",
    rateLimitMax: 100,
    cronSecret: TEST_CRON_SECRET,
    reminderRegistry: registry,
    nowProvider: () => currentNow,
  });

  beforeEach(async () => {
    currentNow = new Date("2026-12-01T18:00:00.000Z");
    await prisma.notification.deleteMany();
    await prisma.notificationPreference.deleteMany();
    await prisma.programBalance.deleteMany();
    await prisma.walletCard.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rateLimit.deleteMany();

    registry.register(
      "POINTS_EXPIRY",
      createPointsExpiryReminderGenerator((userId) =>
        pointsRepo.findReminderBalancesByUserId(userId),
      ),
    );
  });

  afterAll(async () => {
    await prisma.notification.deleteMany();
    await prisma.notificationPreference.deleteMany();
    await prisma.programBalance.deleteMany();
    await prisma.walletCard.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rateLimit.deleteMany();
  });

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
    const authCookie = res.headers["set-cookie"]![0]!.split(";")[0]!;
    return {
      userId: res.body.user.id as string,
      cookies: `${authCookie}; ${csrfCookie}`,
      csrfToken,
    };
  }

  it("AC1, AC2, AC3: saves balance for wallet program, computes dollar value, enforces user isolation (404), and generates 30d/7d expiry reminders", async () => {
    const userA = await registerUser("usera-pts@example.com", "User A");
    const userB = await registerUser("userb-pts@example.com", "User B");

    const catalogRes = await request(app)
      .get("/api/v1/catalog/cards")
      .set("Cookie", userA.cookies);
    expect(catalogRes.status).toBe(200);
    const harborCard = catalogRes.body.cards.find((c: { name: string }) =>
      c.name.includes("Harbor"),
    );
    expect(harborCard).toBeDefined();

    // Add Harbor card to User A's wallet
    const addCardRes = await request(app)
      .post("/api/v1/wallet/cards")
      .set("Cookie", userA.cookies)
      .set("x-csrf-token", userA.csrfToken)
      .send({ cardId: harborCard.id });
    expect(addCardRes.status).toBe(201);

    // GET /api/v1/points-balances for User A returns Harbor's rewards program
    const getProgramsRes = await request(app)
      .get("/api/v1/points-balances")
      .set("Cookie", userA.cookies);
    expect(getProgramsRes.status).toBe(200);
    expect(getProgramsRes.body.programs).toHaveLength(1);
    const programId = getProgramsRes.body.programs[0].programId as string;

    // User A sets 10,000 points expiring 2026-12-31
    const putRes = await request(app)
      .put(`/api/v1/points-balances/${programId}`)
      .set("Cookie", userA.cookies)
      .set("x-csrf-token", userA.csrfToken)
      .send({ pointsBalance: 10000, expiryDate: "2026-12-31" });
    expect(putRes.status).toBe(200);
    expect(putRes.body.programBalance).toMatchObject({
      programId,
      pointsBalance: 10000,
      valueCents: 12500,
      expiryDate: "2026-12-31",
    });

    // User B cannot update User A's program balance (program not in User B's wallet -> 404)
    const crossPut = await request(app)
      .put(`/api/v1/points-balances/${programId}`)
      .set("Cookie", userB.cookies)
      .set("x-csrf-token", userB.csrfToken)
      .send({ pointsBalance: 500, expiryDate: "2026-12-31" });
    expect(crossPut.status).toBe(404);

    // Cron on 2026-12-01 (30 days before 2026-12-31) creates 1 reminder
    const cron30 = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(cron30.status).toBe(200);
    expect(cron30.body.createdCount).toBe(1);

    // Cron on 2026-12-24 (7 days before 2026-12-31) creates 1 reminder
    currentNow = new Date("2026-12-24T18:00:00.000Z");
    const cron7 = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(cron7.status).toBe(200);
    expect(cron7.body.createdCount).toBe(1);

    const notifsRes = await request(app)
      .get("/api/v1/notifications")
      .set("Cookie", userA.cookies);
    expect(notifsRes.status).toBe(200);
    expect(notifsRes.body.notifications).toHaveLength(2);
  });
});
