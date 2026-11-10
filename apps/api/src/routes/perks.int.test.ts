import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../db.js";
import { NotificationService } from "../services/notification.service.js";
import { getCsrfTokenAndCookie } from "./test-helpers.js";

describe("Perks Integration Tests (US-06 / Issue #21)", () => {
  const TEST_CRON_SECRET = "int-test-perks-cron-secret";
  let currentNow = new Date("2026-11-10T18:00:00.000Z");

  const app = createApp({
    prisma,
    schema: "test",
    rateLimitMax: 100,
    generalRateLimitMax: 100,
    cronSecret: TEST_CRON_SECRET,
    nowProvider: () => currentNow,
  });

  let harborCardId = "";
  let ridePerkId = "";

  beforeEach(async () => {
    currentNow = new Date("2026-11-10T18:00:00.000Z");
    await prisma.notification.deleteMany();
    await prisma.notificationPreference.deleteMany();
    await prisma.perkUsage.deleteMany();
    await prisma.perk.deleteMany();
    await prisma.walletCardPaidCycle.deleteMany();
    await prisma.walletCardPaymentSetting.deleteMany();
    await prisma.walletCard.deleteMany();
    await prisma.card.deleteMany();
    await prisma.rewardsProgram.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rateLimit.deleteMany();

    const program = await prisma.rewardsProgram.create({
      data: {
        name: "Harbor Points",
        centsPer100Points: 125,
      },
    });

    const card = await prisma.card.create({
      data: {
        name: "Harbor Travel Plus",
        issuer: "Demo Bank",
        artColor: "#2F74D0",
        isDemo: true,
        programId: program.id,
        annualFeeCents: 9500,
        baseRateX100: 100,
        perks: {
          create: [
            {
              name: "Dining credit",
              amountCents: 1000,
              period: "MONTHLY",
            },
            {
              name: "Ride credit",
              amountCents: 1500,
              period: "MONTHLY",
            },
          ],
        },
      },
      include: {
        perks: true,
      },
    });

    harborCardId = card.id;
    const ride = card.perks.find((p) => p.name === "Ride credit")!;
    ridePerkId = ride.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("AC1..AC4: tracks perks, allows partial and full usage, resets at month boundary, and sends 5-day reminder", async () => {
    // 1. Create User A
    const csrfA = await getCsrfTokenAndCookie(app);
    const signupA = await request(app)
      .post("/api/v1/auth/signup")
      .set("x-csrf-token", csrfA.token)
      .set("Cookie", csrfA.cookie)
      .send({
        name: "User A",
        email: "user-a-perks@example.com",
        password: "Password123",
        confirmPassword: "Password123",
      });
    expect(signupA.status).toBe(201);
    const cookieUserA = signupA.headers["set-cookie"]![0]!;

    // 2. Add Harbor Travel Plus to User A's wallet
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const addCardRes = await request(app)
      .post("/api/v1/wallet/cards")
      .set("Cookie", `${cookieUserA}; ${csrfCookie}`)
      .set("x-csrf-token", csrfToken)
      .send({
        cardId: harborCardId,
        nickname: "My Harbor Travel",
      });
    expect(addCardRes.status).toBe(201);
    const walletCardId = addCardRes.body.walletCard.id;

    // 3. AC1: List perks for User A -> shows both perks with $0 used and full left
    const listPerksRes1 = await request(app)
      .get("/api/v1/perks")
      .set("Cookie", cookieUserA);
    expect(listPerksRes1.status).toBe(200);
    expect(listPerksRes1.body.perks).toHaveLength(2);
    expect(listPerksRes1.body.summary).toEqual({
      totalAmountCents: 2500,
      totalUsedCents: 0,
      totalLeftCents: 2500,
    });

    // 4. AC2: Mark ride credit as partly used ($5.00 / 500 cents)
    const { token: csrfToken2, cookie: csrfCookie2 } =
      await getCsrfTokenAndCookie(app);
    const markPartialRes = await request(app)
      .post(`/api/v1/wallet/cards/${walletCardId}/perks/${ridePerkId}/usage`)
      .set("Cookie", `${cookieUserA}; ${csrfCookie2}`)
      .set("x-csrf-token", csrfToken2)
      .send({ usedCents: 500 });
    expect(markPartialRes.status).toBe(200);
    expect(markPartialRes.body.perk.usedCents).toBe(500);
    expect(markPartialRes.body.perk.leftCents).toBe(1000);
    expect(markPartialRes.body.perk.isUsed).toBe(false);

    // 5. AC1: Check list perks reflects partial usage
    const listPerksRes2 = await request(app)
      .get("/api/v1/perks")
      .set("Cookie", cookieUserA);
    expect(listPerksRes2.status).toBe(200);
    expect(listPerksRes2.body.summary).toEqual({
      totalAmountCents: 2500,
      totalUsedCents: 500,
      totalLeftCents: 2000,
    });

    // 6. AC4: Daily reminder job run before 5 days (Nov 20) -> no reminder created
    currentNow = new Date("2026-11-20T18:00:00.000Z");
    const cronRes1 = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(cronRes1.status).toBe(200);
    expect(cronRes1.body.createdCount).toBe(0);

    // 7. AC4: Daily reminder job run 5 days before Nov 30 (Nov 25) -> creates 2 reminders (both dining and ride have money left)
    currentNow = new Date("2026-11-25T18:00:00.000Z");
    const notifService = new NotificationService(
      app.get("notificationRepo"),
      app.get("reminderRegistry"),
      () => currentNow,
    );
    const cronRun = await notifService.runDailyReminderJob();
    expect(cronRun.createdCount).toBe(2);

    // Re-running cron on Nov 26 -> 0 created (idempotent, no duplicates)
    currentNow = new Date("2026-11-26T18:00:00.000Z");
    const cronRun2 = await notifService.runDailyReminderJob();
    expect(cronRun2.createdCount).toBe(0);

    // 8. User A checks notifications -> finds both reminders
    const notifsRes = await request(app)
      .get("/api/v1/notifications")
      .set("Cookie", cookieUserA);
    expect(notifsRes.status).toBe(200);
    expect(notifsRes.body.notifications).toHaveLength(2);
    const rideNotif = notifsRes.body.notifications.find(
      (n: { title: string }) => n.title.includes("Ride credit"),
    );
    expect(rideNotif).toBeDefined();
    expect(rideNotif.body).toContain("$10.00"); // $10.00 left on ride credit

    // 9. AC3: Advance time into next period (Dec 1, 2026) -> perks reset!
    currentNow = new Date("2026-12-01T18:00:00.000Z");
    const listPerksDec = await request(app)
      .get("/api/v1/perks")
      .set("Cookie", cookieUserA);
    expect(listPerksDec.status).toBe(200);
    expect(listPerksDec.body.summary).toEqual({
      totalAmountCents: 2500,
      totalUsedCents: 0,
      totalLeftCents: 2500,
    });
    const decRidePerk = listPerksDec.body.perks.find(
      (p: { perkId: string }) => p.perkId === ridePerkId,
    );
    expect(decRidePerk.periodKey).toBe("2026-12");
    expect(decRidePerk.usedCents).toBe(0);
    expect(decRidePerk.leftCents).toBe(1500);

    // 10. Multi-tenant security: Create User B and attempt to mark User A's perk -> 404
    const csrfB = await getCsrfTokenAndCookie(app);
    const signupB = await request(app)
      .post("/api/v1/auth/signup")
      .set("x-csrf-token", csrfB.token)
      .set("Cookie", csrfB.cookie)
      .send({
        name: "User B",
        email: "user-b-perks@example.com",
        password: "Password123",
        confirmPassword: "Password123",
      });
    const cookieUserB = signupB.headers["set-cookie"]![0]!;
    const { token: csrfTokenB, cookie: csrfCookieB } =
      await getCsrfTokenAndCookie(app);

    const crossUserRes = await request(app)
      .post(`/api/v1/wallet/cards/${walletCardId}/perks/${ridePerkId}/usage`)
      .set("Cookie", `${cookieUserB}; ${csrfCookieB}`)
      .set("x-csrf-token", csrfTokenB)
      .send({ usedCents: 1000 });
    expect(crossUserRes.status).toBe(404);
    expect(crossUserRes.body.error.code).toBe("NOT_FOUND");
  }, 30000);
});
