import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";
import {
  NotificationItem,
  NotificationPreferenceItem,
} from "@swipewise/shared";
import { createApp } from "../app.js";
import { getJwtSecret } from "../middleware/auth.middleware.js";
import {
  createReminderGeneratorRegistry,
  GeneratedReminderCandidate,
} from "../domain/reminders.js";
import {
  createRotatingCategoryReminderGenerator,
  RotatingReminderCardInput,
} from "../domain/rotating-categories.js";
import { RankableCard } from "../domain/rank-cards.js";
import { getCsrfTokenAndCookie } from "./test-helpers.js";

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

describe("Rotating Bonus Categories & Quarter Activations API route tests (US-05 / Issue #23)", () => {
  const TEST_CRON_SECRET = "test-cron-secret-23";
  const USER_A_ID = "11111111-1111-4111-8111-111111111111";
  const USER_B_ID = "22222222-2222-4222-8222-222222222222";
  const WALLET_CARD_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const CATALOG_ORBIT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  let currentNow = new Date("2026-12-25T18:00:00.000Z"); // 2026-12-25 in America/Los_Angeles (2026-Q4, 7 days before 2027-Q1)
  let mockActivatedQuarters: Record<string, string[]> = {};
  let mockNotifications: NotificationItem[] = [];
  let mockPreferences: NotificationPreferenceItem[] = [];

  const registry = createReminderGeneratorRegistry();

  const fakePrisma = {
    $executeRawUnsafe: async () => 0,
    $queryRawUnsafe: async () => [
      { total_hits: 1, reset_time: new Date(Date.now() + 60000) },
    ],
  } as unknown as Parameters<typeof createApp>[0] extends { prisma?: infer P }
    ? P
    : never;

  const app = createApp({
    prisma: fakePrisma,
    rateLimitMax: 100,
    cronSecret: TEST_CRON_SECRET,
    reminderRegistry: registry,
    nowProvider: () => currentNow,
  });

  beforeEach(() => {
    currentNow = new Date("2026-12-25T18:00:00.000Z");
    mockActivatedQuarters = {
      [WALLET_CARD_A_ID]: [],
    };
    mockNotifications = [];
    mockPreferences = [];

    registry.register(
      "ROTATING_CATEGORY",
      createRotatingCategoryReminderGenerator(async (userId: string) => {
        if (userId !== USER_A_ID) return [];
        const cardInput: RotatingReminderCardInput = {
          walletCardId: WALLET_CARD_A_ID,
          userId: USER_A_ID,
          cardDisplayName: "Orbit Quarterly",
          rotatingQuarters: ["2026-Q4", "2027-Q1"],
          activatedQuarters: mockActivatedQuarters[WALLET_CARD_A_ID] ?? [],
        };
        return [cardInput];
      }),
    );

    const buildMockWalletCard = () => {
      const activated = mockActivatedQuarters[WALLET_CARD_A_ID] ?? [];
      return {
        id: WALLET_CARD_A_ID,
        userId: USER_A_ID,
        cardId: CATALOG_ORBIT_ID,
        nickname: null,
        openedDate: "2025-01-01",
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
        paymentSettings: null,
        paidCycles: [],
        activatedQuarters: activated,
        rotatingQuarters: {
          currentQuarter: {
            quarter: "2026-Q4",
            isActivated: activated.includes("2026-Q4"),
            categories: [
              { category: "GAS" as const, rateX100: 500, capCents: 150000 },
            ],
          },
          nextQuarter: {
            quarter: "2027-Q1",
            isActivated: activated.includes("2027-Q1"),
            categories: [
              {
                category: "GROCERIES" as const,
                rateX100: 500,
                capCents: 150000,
              },
            ],
          },
        },
        card: {
          id: CATALOG_ORBIT_ID,
          name: "Orbit Quarterly",
          issuer: "Demo Bank",
          artColor: "#6C5CE7",
          isDemo: true,
          annualFeeCents: 0,
          baseRateX100: 100,
          program: { name: "Cash Back", centsPer100Points: 100 },
          rates: [],
          rotatingCategories: [
            {
              quarter: "2026-Q4",
              category: "GAS" as const,
              rateX100: 500,
              capCents: 150000,
            },
            {
              quarter: "2027-Q1",
              category: "GROCERIES" as const,
              rateX100: 500,
              capCents: 150000,
            },
          ],
        },
      };
    };

    app.set("walletRepo", {
      findWalletCardsByUserId: async (userId: string) =>
        userId === USER_A_ID ? [buildMockWalletCard()] : [],
      findWalletCardByIdAndUserId: async (id: string, userId: string) =>
        id === WALLET_CARD_A_ID && userId === USER_A_ID
          ? buildMockWalletCard()
          : null,
      findUserTimeZone: async () => "America/Los_Angeles",
      activateQuarter: async (
        walletCardId: string,
        userId: string,
        quarter: string,
        activatedAt: Date,
      ) => {
        if (walletCardId !== WALLET_CARD_A_ID || userId !== USER_A_ID) {
          return null;
        }
        const list = mockActivatedQuarters[WALLET_CARD_A_ID] ?? [];
        if (!list.includes(quarter)) {
          list.push(quarter);
          mockActivatedQuarters[WALLET_CARD_A_ID] = list;
        }
        const dedupeKey = `ROTATING_CATEGORY:${walletCardId}:${quarter}`;
        for (const n of mockNotifications) {
          if (
            n.userId === userId &&
            n.dedupeKey === dedupeKey &&
            n.dismissedAt === null
          ) {
            n.dismissedAt = activatedAt.toISOString();
          }
        }
        return {
          activation: {
            walletCardId,
            quarter,
            activatedAt: activatedAt.toISOString(),
          },
          walletCard: buildMockWalletCard(),
        };
      },
    });

    app.set("recommendationRepo", {
      findUserTimeZone: async () => "America/Los_Angeles",
      findWalletCardsByUserId: async (
        userId: string,
      ): Promise<RankableCard[]> =>
        userId === USER_A_ID
          ? [
              {
                walletCardId: WALLET_CARD_A_ID,
                cardId: CATALOG_ORBIT_ID,
                name: "Orbit Quarterly",
                issuer: "Demo Bank",
                artColor: "#6C5CE7",
                isDemo: true,
                nickname: null,
                annualFeeCents: 0,
                baseRateX100: 100,
                program: { name: "Cash Back", centsPer100Points: 100 },
                rules: [],
                rotatingRules: [
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
                activatedQuarters:
                  mockActivatedQuarters[WALLET_CARD_A_ID] ?? [],
              },
            ]
          : [],
    });

    app.set("notificationRepo", {
      findUsersForReminderJob: async () => [
        {
          id: USER_A_ID,
          timeZone: "America/Los_Angeles",
          preferences: mockPreferences,
        },
      ],
      createNotificationsSkippingDuplicates: async (
        candidates: GeneratedReminderCandidate[],
      ) => {
        let created = 0;
        for (const c of candidates) {
          const exists = mockNotifications.some(
            (n) => n.dedupeKey === c.dedupeKey,
          );
          if (!exists) {
            mockNotifications.push({
              id: `00000000-0000-4000-8000-${String(mockNotifications.length + 1).padStart(12, "0")}`,
              userId: c.userId,
              type: c.type,
              title: c.title,
              body: c.body,
              dueDate: c.dueDate,
              dedupeKey: c.dedupeKey,
              dismissedAt: null,
              createdAt: currentNow.toISOString(),
            });
            created += 1;
          }
        }
        return created;
      },
      findActiveNotificationsByUserId: async (userId: string) =>
        mockNotifications.filter(
          (n) => n.userId === userId && n.dismissedAt === null,
        ),
    });
  });

  it("AC1 & AC2: shows current and next quarter categories on wallet cards and lets the user activate the current or next quarter", async () => {
    const authCookie = await createAuthCookie(USER_A_ID, "usera@example.com");
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const cookies = `${authCookie}; ${csrfCookie}`;

    const getRes = await request(app)
      .get("/api/v1/wallet/cards")
      .set("Cookie", cookies);
    expect(getRes.status).toBe(200);
    expect(getRes.body.walletCards[0].rotatingQuarters).toEqual({
      currentQuarter: {
        quarter: "2026-Q4",
        isActivated: false,
        categories: [{ category: "GAS", rateX100: 500, capCents: 150000 }],
      },
      nextQuarter: {
        quarter: "2027-Q1",
        isActivated: false,
        categories: [
          { category: "GROCERIES", rateX100: 500, capCents: 150000 },
        ],
      },
    });

    const activateRes = await request(app)
      .post(`/api/v1/wallet/cards/${WALLET_CARD_A_ID}/quarter-activations`)
      .set("Cookie", cookies)
      .set("x-csrf-token", csrfToken)
      .send({ quarter: "2026-Q4" });
    expect(activateRes.status).toBe(200);
    expect(activateRes.body.activation.quarter).toBe("2026-Q4");
    expect(
      activateRes.body.walletCard.rotatingQuarters.currentQuarter.isActivated,
    ).toBe(true);
  });

  it("Validation: only accepts the current or next quarter (validated with Zod in packages/shared); anything else returns 400", async () => {
    const authCookie = await createAuthCookie(USER_A_ID, "usera@example.com");
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const cookies = `${authCookie}; ${csrfCookie}`;

    // Past quarter (2026-Q3 when current is 2026-Q4) -> 400
    const pastQuarterRes = await request(app)
      .post(`/api/v1/wallet/cards/${WALLET_CARD_A_ID}/quarter-activations`)
      .set("Cookie", cookies)
      .set("x-csrf-token", csrfToken)
      .send({ quarter: "2026-Q3" });
    expect(pastQuarterRes.status).toBe(400);
    expect(pastQuarterRes.body.error.code).toBe("VALIDATION_ERROR");

    // Far future quarter (2027-Q2 when next is 2027-Q1) -> 400
    const farFutureRes = await request(app)
      .post(`/api/v1/wallet/cards/${WALLET_CARD_A_ID}/quarter-activations`)
      .set("Cookie", cookies)
      .set("x-csrf-token", csrfToken)
      .send({ quarter: "2027-Q2" });
    expect(farFutureRes.status).toBe(400);
    expect(farFutureRes.body.error.code).toBe("VALIDATION_ERROR");

    // Malformed quarter -> 400
    const malformedRes = await request(app)
      .post(`/api/v1/wallet/cards/${WALLET_CARD_A_ID}/quarter-activations`)
      .set("Cookie", cookies)
      .set("x-csrf-token", csrfToken)
      .send({ quarter: "2026-Q5" });
    expect(malformedRes.status).toBe(400);

    // Next quarter (2027-Q1) -> 200
    const nextQuarterRes = await request(app)
      .post(`/api/v1/wallet/cards/${WALLET_CARD_A_ID}/quarter-activations`)
      .set("Cookie", cookies)
      .set("x-csrf-token", csrfToken)
      .send({ quarter: "2027-Q1" });
    expect(nextQuarterRes.status).toBe(200);
  });

  it("Security: User B cannot activate User A's wallet card (returns 404)", async () => {
    const userBAuthCookie = await createAuthCookie(
      USER_B_ID,
      "userb@example.com",
    );
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const userBCookies = `${userBAuthCookie}; ${csrfCookie}`;

    const attempt = await request(app)
      .post(`/api/v1/wallet/cards/${WALLET_CARD_A_ID}/quarter-activations`)
      .set("Cookie", userBCookies)
      .set("x-csrf-token", csrfToken)
      .send({ quarter: "2026-Q4" });
    expect(attempt.status).toBe(404);
  });

  it("AC3: recommendations endpoint ranks unactivated rotating card at base rate with 'Activate to earn 5%' note, and at 5% bonus rate once activated", async () => {
    const authCookie = await createAuthCookie(USER_A_ID, "usera@example.com");
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const cookies = `${authCookie}; ${csrfCookie}`;

    // Before activation: 1% base rate ($1.00) with "Activate to earn 5%"
    const unactivatedRec = await request(app)
      .get("/api/v1/recommendations?category=GAS&amountCents=10000")
      .set("Cookie", cookies);
    expect(unactivatedRec.status).toBe(200);
    expect(unactivatedRec.body.rankedCards[0].rewardCents).toBe(100);
    expect(unactivatedRec.body.rankedCards[0].activationNote).toBe(
      "Activate to earn 5%",
    );

    // Activate 2026-Q4
    await request(app)
      .post(`/api/v1/wallet/cards/${WALLET_CARD_A_ID}/quarter-activations`)
      .set("Cookie", cookies)
      .set("x-csrf-token", csrfToken)
      .send({ quarter: "2026-Q4" });

    // After activation: 5% bonus rate ($5.00) with no note
    const activatedRec = await request(app)
      .get("/api/v1/recommendations?category=GAS&amountCents=10000")
      .set("Cookie", cookies);
    expect(activatedRec.status).toBe(200);
    expect(activatedRec.body.rankedCards[0].rewardCents).toBe(500);
    expect(activatedRec.body.rankedCards[0].activationNote).toBeNull();
  });

  it("AC4: cron creates ROTATING_CATEGORY reminder 7 days before quarter start, skips duplicates, and skips when preference is off", async () => {
    // 1. If preference is disabled, creates 0 reminders
    mockPreferences = [{ type: "ROTATING_CATEGORY", enabled: false }];
    const disabledCron = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(disabledCron.status).toBe(200);
    expect(disabledCron.body.createdCount).toBe(0);

    // 2. Enable preference -> creates 1 reminder for 2027-Q1
    mockPreferences = [{ type: "ROTATING_CATEGORY", enabled: true }];
    const cron1 = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(cron1.status).toBe(200);
    expect(cron1.body.createdCount).toBe(1);
    expect(mockNotifications[0]?.dedupeKey).toBe(
      `ROTATING_CATEGORY:${WALLET_CARD_A_ID}:2027-Q1`,
    );

    // 3. Running twice gives no duplicates
    const cron2 = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(cron2.status).toBe(200);
    expect(cron2.body.createdCount).toBe(0);
  });
});
