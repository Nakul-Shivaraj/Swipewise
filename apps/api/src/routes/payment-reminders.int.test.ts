import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../db.js";
import { createReminderGeneratorRegistry } from "../domain/reminders.js";
import { createPaymentDueReminderGenerator } from "../domain/payment-reminders.js";
import { WalletRepository } from "../repositories/wallet.repository.js";
import { getCsrfTokenAndCookie } from "./test-helpers.js";

describe("Payment Due Reminders Integration (US-08 / Issue #20)", () => {
  const TEST_CRON_SECRET = "int-test-payment-cron-secret";
  let currentNow = new Date("2026-11-10T18:00:00.000Z"); // 2026-11-10 in America/Los_Angeles
  const registry = createReminderGeneratorRegistry();
  const walletRepo = new WalletRepository(prisma);

  const app = createApp({
    prisma,
    schema: "test",
    rateLimitMax: 100,
    cronSecret: TEST_CRON_SECRET,
    reminderRegistry: registry,
    nowProvider: () => currentNow,
  });

  let catalogCardId = "";

  beforeEach(async () => {
    currentNow = new Date("2026-11-10T18:00:00.000Z");
    await prisma.notification.deleteMany();
    await prisma.notificationPreference.deleteMany();
    await prisma.walletCard.deleteMany();
    await prisma.card.deleteMany();
    await prisma.rewardsProgram.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rateLimit.deleteMany();

    const program = await prisma.rewardsProgram.create({
      data: {
        name: "Cash Back",
        centsPer100Points: 100,
      },
    });
    const card = await prisma.card.create({
      data: {
        name: "Mint Everyday",
        issuer: "Demo Bank",
        artColor: "#2F8C55",
        isDemo: true,
        programId: program.id,
        annualFeeCents: 0,
        baseRateX100: 100,
      },
    });
    catalogCardId = card.id;

    registry.register(
      "PAYMENT_DUE",
      createPaymentDueReminderGenerator((userId) =>
        walletRepo.findPaymentReminderCardsByUserId(userId),
      ),
    );
  });

  afterAll(async () => {
    await prisma.notification.deleteMany();
    await prisma.notificationPreference.deleteMany();
    await prisma.walletCard.deleteMany();
    await prisma.card.deleteMany();
    await prisma.rewardsProgram.deleteMany();
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

  it("AC1..AC4: sets dueDay + autopay, generates payment reminders, prevents cross-user edits, and stops cycle reminders when marked paid while reminding next month", async () => {
    const userA = await registerUser("usera-pay@example.com", "User A");
    const userB = await registerUser("userb-pay@example.com", "User B");

    // User A adds a card to wallet
    const addRes = await request(app)
      .post("/api/v1/wallet/cards")
      .set("Cookie", userA.cookies)
      .set("x-csrf-token", userA.csrfToken)
      .send({ cardId: catalogCardId, nickname: "Mint" });
    expect(addRes.status).toBe(201);
    const walletCardId = addRes.body.walletCard.id as string;

    // User A sets dueDay=15, isAutopay=false
    const setRes = await request(app)
      .put(`/api/v1/wallet/cards/${walletCardId}/payment-settings`)
      .set("Cookie", userA.cookies)
      .set("x-csrf-token", userA.csrfToken)
      .send({ dueDay: 15, isAutopay: false });
    expect(setRes.status).toBe(200);
    expect(setRes.body.walletCard.paymentSettings).toEqual({
      dueDay: 15,
      isAutopay: false,
    });

    // User B tries to edit User A's payment settings -> 404
    const crossEdit = await request(app)
      .put(`/api/v1/wallet/cards/${walletCardId}/payment-settings`)
      .set("Cookie", userB.cookies)
      .set("x-csrf-token", userB.csrfToken)
      .send({ dueDay: 1, isAutopay: true });
    expect(crossEdit.status).toBe(404);

    // Run cron on 2026-11-10 (5 days before Nov 15) -> 1 notification created
    const cron1 = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(cron1.status).toBe(200);
    expect(cron1.body.createdCount).toBe(1);

    // Run cron again on same day -> 0 notifications created (idempotent)
    const cron2 = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(cron2.status).toBe(200);
    expect(cron2.body.createdCount).toBe(0);

    // User A marks 2026-11 cycle paid
    const paidRes = await request(app)
      .post(`/api/v1/wallet/cards/${walletCardId}/paid-cycles`)
      .set("Cookie", userA.cookies)
      .set("x-csrf-token", userA.csrfToken)
      .send({ cycleYearMonth: "2026-11" });
    expect(paidRes.status).toBe(200);

    // On 2026-11-14 (1 day before Nov 15), cron creates 0 notifications because 2026-11 is paid
    currentNow = new Date("2026-11-14T18:00:00.000Z");
    const cronNov14 = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(cronNov14.status).toBe(200);
    expect(cronNov14.body.createdCount).toBe(0);

    // Next month on 2026-12-10 (5 days before Dec 15), cron creates 1 notification for 2026-12
    currentNow = new Date("2026-12-10T18:00:00.000Z");
    const cronDec10 = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(cronDec10.status).toBe(200);
    expect(cronDec10.body.createdCount).toBe(1);
  });
});
