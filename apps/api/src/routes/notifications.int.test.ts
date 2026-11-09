import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../db.js";
import {
  createReminderGeneratorRegistry,
  createTestReminderGenerator,
} from "../domain/reminders.js";
import { getCsrfTokenAndCookie } from "./test-helpers.js";

describe("Notifications & Daily Reminder Job Integration (US-05..09 / Issue #19)", () => {
  const TEST_CRON_SECRET = "int-test-cron-secret-99999";
  const fixedNow = new Date("2026-11-10T03:30:00.000Z"); // 2026-11-09 in America/Los_Angeles
  const registry = createReminderGeneratorRegistry();

  const app = createApp({
    prisma,
    schema: "test",
    rateLimitMax: 100,
    cronSecret: TEST_CRON_SECRET,
    reminderRegistry: registry,
    nowProvider: () => fixedNow,
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany();
    await prisma.notificationPreference.deleteMany();
    await prisma.walletCard.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rateLimit.deleteMany();

    registry.register(
      "PAYMENT_DUE",
      createTestReminderGenerator({
        type: "PAYMENT_DUE",
        title: "Payment due in 5 days",
        body: "Mint Everyday payment is due soon.",
      }),
    );
    registry.register(
      "PERK_ENDING",
      createTestReminderGenerator({
        type: "PERK_ENDING",
        title: "Ride credit ends in 5 days",
        body: "Harbor Travel Plus $15.00 ride credit resets soon.",
      }),
    );
  });

  afterAll(async () => {
    await prisma.notification.deleteMany();
    await prisma.notificationPreference.deleteMany();
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

  it("rejects GET /api/v1/cron/reminders without secret or with wrong secret (401)", async () => {
    const noSecret = await request(app).get("/api/v1/cron/reminders");
    expect(noSecret.status).toBe(401);

    const wrongSecret = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", "Bearer wrong");
    expect(wrongSecret.status).toBe(401);
  });

  it("AC1, AC2, AC3: creates reminders on by default, skips disabled types, is idempotent on repeat runs, and enforces user ownership on dismiss", async () => {
    const userA = await registerUser("usera-rem@example.com", "User A");
    const userB = await registerUser("userb-rem@example.com", "User B");

    // User A turns off PERK_ENDING; PAYMENT_DUE has no saved row (enabled by default)
    const prefRes = await request(app)
      .patch("/api/v1/notification-preferences")
      .set("Cookie", userA.cookies)
      .set("x-csrf-token", userA.csrfToken)
      .send({ type: "PERK_ENDING", enabled: false });
    expect(prefRes.status).toBe(200);

    // Run daily cron job #1
    const cron1 = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(cron1.status).toBe(200);
    // User A gets 1 (PAYMENT_DUE), User B gets 2 (PAYMENT_DUE + PERK_ENDING) = 3 total
    expect(cron1.body.createdCount).toBe(3);

    // Run daily cron job #2 -> idempotent, 0 new rows created
    const cron2 = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(cron2.status).toBe(200);
    expect(cron2.body.createdCount).toBe(0);

    // User A lists notifications -> sees 1 (PAYMENT_DUE)
    const listA = await request(app)
      .get("/api/v1/notifications")
      .set("Cookie", userA.cookies);
    expect(listA.status).toBe(200);
    expect(listA.body.notifications).toHaveLength(1);
    expect(listA.body.notifications[0].type).toBe("PAYMENT_DUE");
    expect(listA.body.notifications[0].dueDate).toBe("2026-11-09");

    const userANotifId = listA.body.notifications[0].id as string;

    // User B tries to dismiss User A's notification -> 404
    const crossDismiss = await request(app)
      .post(`/api/v1/notifications/${userANotifId}/dismiss`)
      .set("Cookie", userB.cookies)
      .set("x-csrf-token", userB.csrfToken);
    expect(crossDismiss.status).toBe(404);

    // User A dismisses their own notification -> 200 and no longer listed
    const selfDismiss = await request(app)
      .post(`/api/v1/notifications/${userANotifId}/dismiss`)
      .set("Cookie", userA.cookies)
      .set("x-csrf-token", userA.csrfToken);
    expect(selfDismiss.status).toBe(200);

    const listAAfter = await request(app)
      .get("/api/v1/notifications")
      .set("Cookie", userA.cookies);
    expect(listAAfter.status).toBe(200);
    expect(listAAfter.body.notifications).toHaveLength(0);
  });
});
