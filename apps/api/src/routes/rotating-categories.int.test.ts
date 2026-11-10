import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../db.js";
import { createReminderGeneratorRegistry } from "../domain/reminders.js";
import { createRotatingCategoryReminderGenerator } from "../domain/rotating-categories.js";
import { WalletRepository } from "../repositories/wallet.repository.js";
import { getCsrfTokenAndCookie } from "./test-helpers.js";

const hasTestDatabase = Boolean(
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
);

describe.skipIf(!hasTestDatabase)(
  "Rotating Bonus Categories Integration (US-05 / Issue #23)",
  () => {
    const TEST_CRON_SECRET = "int-test-rotating-cron-secret";
    let currentNow = new Date("2026-12-25T18:00:00.000Z"); // 2026-12-25 in America/Los_Angeles (2026-Q4, 7 days before 2027-Q1)
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

    let orbitCardId = "";

    beforeEach(async () => {
      currentNow = new Date("2026-12-25T18:00:00.000Z");
      await prisma.notification.deleteMany();
      await prisma.notificationPreference.deleteMany();
      await prisma.walletCard.deleteMany();
      await prisma.rewardRule.deleteMany();
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
      const orbitCard = await prisma.card.create({
        data: {
          name: "Orbit Quarterly",
          issuer: "Demo Bank",
          artColor: "#6C5CE7",
          isDemo: true,
          programId: program.id,
          annualFeeCents: 0,
          baseRateX100: 100,
          rotatingCategories: {
            create: [
              {
                quarter: "2026-Q4",
                category: "GAS",
                rateX100: 500,
                capCents: 150000,
              },
              {
                quarter: "2027-Q1",
                category: "GROCERIES",
                rateX100: 500,
                capCents: 150000,
              },
            ],
          },
        },
      });
      orbitCardId = orbitCard.id;

      registry.register(
        "ROTATING_CATEGORY",
        createRotatingCategoryReminderGenerator((userId) =>
          walletRepo.findRotatingReminderCardsByUserId(userId),
        ),
      );
    });

    afterAll(async () => {
      await prisma.notification.deleteMany();
      await prisma.notificationPreference.deleteMany();
      await prisma.walletCard.deleteMany();
      await prisma.rewardRule.deleteMany();
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

    it("AC1..AC4: shows current and next quarter categories, validates quarter input, prevents cross-user activation (404), ranks unactivated vs activated, and sends 7-day reminder", async () => {
      const userA = await registerUser("usera-rot@example.com", "User A");
      const userB = await registerUser("userb-rot@example.com", "User B");

      // User A adds Orbit Quarterly to wallet
      const addRes = await request(app)
        .post("/api/v1/wallet/cards")
        .set("Cookie", userA.cookies)
        .set("x-csrf-token", userA.csrfToken)
        .send({ cardId: orbitCardId });
      expect(addRes.status).toBe(201);
      const walletCardId = addRes.body.walletCard.id as string;
      expect(
        addRes.body.walletCard.rotatingQuarters.currentQuarter.quarter,
      ).toBe("2026-Q4");
      expect(addRes.body.walletCard.rotatingQuarters.nextQuarter.quarter).toBe(
        "2027-Q1",
      );

      // Unactivated ranking on GAS: 1% base ($1.00) with "Activate to earn 5%"
      const recBefore = await request(app)
        .get("/api/v1/recommendations?category=GAS&amountCents=10000")
        .set("Cookie", userA.cookies);
      expect(recBefore.status).toBe(200);
      expect(recBefore.body.rankedCards[0].rewardCents).toBe(100);
      expect(recBefore.body.rankedCards[0].activationNote).toBe(
        "Activate to earn 5%",
      );

      // Invalid quarter (not current or next) -> 400
      const badQuarter = await request(app)
        .post(`/api/v1/wallet/cards/${walletCardId}/quarter-activations`)
        .set("Cookie", userA.cookies)
        .set("x-csrf-token", userA.csrfToken)
        .send({ quarter: "2026-Q1" });
      expect(badQuarter.status).toBe(400);

      // User B tries to activate User A's card -> 404
      const crossAttempt = await request(app)
        .post(`/api/v1/wallet/cards/${walletCardId}/quarter-activations`)
        .set("Cookie", userB.cookies)
        .set("x-csrf-token", userB.csrfToken)
        .send({ quarter: "2026-Q4" });
      expect(crossAttempt.status).toBe(404);

      // User A activates 2026-Q4
      const actRes = await request(app)
        .post(`/api/v1/wallet/cards/${walletCardId}/quarter-activations`)
        .set("Cookie", userA.cookies)
        .set("x-csrf-token", userA.csrfToken)
        .send({ quarter: "2026-Q4" });
      expect(actRes.status).toBe(200);

      // Activated ranking on GAS: 5% bonus ($5.00), no activation note
      const recAfter = await request(app)
        .get("/api/v1/recommendations?category=GAS&amountCents=10000")
        .set("Cookie", userA.cookies);
      expect(recAfter.status).toBe(200);
      expect(recAfter.body.rankedCards[0].rewardCents).toBe(500);
      expect(recAfter.body.rankedCards[0].activationNote).toBeNull();

      // Cron on 2026-12-25 (7 days before 2027-Q1) -> creates 1 notification
      const cron1 = await request(app)
        .get("/api/v1/cron/reminders")
        .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
      expect(cron1.status).toBe(200);
      expect(cron1.body.createdCount).toBe(1);

      // Second cron run -> 0 duplicates
      const cron2 = await request(app)
        .get("/api/v1/cron/reminders")
        .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
      expect(cron2.status).toBe(200);
      expect(cron2.body.createdCount).toBe(0);
    });
  },
);
