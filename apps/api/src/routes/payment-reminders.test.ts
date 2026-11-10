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
  createPaymentDueReminderGenerator,
  PaymentReminderCardInput,
} from "../domain/payment-reminders.js";
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

describe("Payment Due Reminders & Settings API route tests (US-08 / Issue #20)", () => {
  const TEST_CRON_SECRET = "test-cron-secret-20";
  const USER_A_ID = "11111111-1111-4111-8111-111111111111";
  const USER_B_ID = "22222222-2222-4222-8222-222222222222";
  const CARD_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  let currentNow = new Date("2026-11-10T18:00:00.000Z"); // 2026-11-10 in America/Los_Angeles
  let mockSettings: Record<
    string,
    { dueDay: number; isAutopay: boolean } | null
  > = {};
  let mockPaidCycles: Record<string, string[]> = {};
  let mockNotifications: NotificationItem[] = [];

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
    currentNow = new Date("2026-11-10T18:00:00.000Z");
    mockSettings = {
      [CARD_A_ID]: { dueDay: 15, isAutopay: false },
    };
    mockPaidCycles = {
      [CARD_A_ID]: [],
    };
    mockNotifications = [];

    registry.register(
      "PAYMENT_DUE",
      createPaymentDueReminderGenerator(async (userId: string) => {
        if (userId !== USER_A_ID) return [];
        const setting = mockSettings[CARD_A_ID];
        if (!setting) return [];
        const cardInput: PaymentReminderCardInput = {
          walletCardId: CARD_A_ID,
          userId: USER_A_ID,
          cardDisplayName: "Mint Everyday",
          dueDay: setting.dueDay,
          isAutopay: setting.isAutopay,
          paidCycles: mockPaidCycles[CARD_A_ID] ?? [],
        };
        return [cardInput];
      }),
    );

    const mockWalletCard = () => ({
      id: CARD_A_ID,
      userId: USER_A_ID,
      cardId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      nickname: "Everyday",
      openedDate: "2025-01-01",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      paymentSettings: mockSettings[CARD_A_ID] ?? null,
      paidCycles: mockPaidCycles[CARD_A_ID] ?? [],
      card: {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        name: "Mint Everyday",
        issuer: "Demo Bank",
        artColor: "#2F8C55",
        isDemo: true,
        annualFeeCents: 0,
        baseRateX100: 100,
        program: { name: "Cash Back", centsPer100Points: 100 },
        rates: [],
      },
    });

    app.set("walletRepo", {
      findWalletCardsByUserId: async (userId: string) =>
        userId === USER_A_ID ? [mockWalletCard()] : [],
      findWalletCardByIdAndUserId: async (id: string, userId: string) =>
        id === CARD_A_ID && userId === USER_A_ID ? mockWalletCard() : null,
      upsertPaymentSettings: async (
        walletCardId: string,
        userId: string,
        data: { dueDay: number; isAutopay: boolean },
      ) => {
        if (walletCardId !== CARD_A_ID || userId !== USER_A_ID) return null;
        mockSettings[CARD_A_ID] = {
          dueDay: data.dueDay,
          isAutopay: data.isAutopay,
        };
        return mockWalletCard();
      },
      markCyclePaid: async (
        walletCardId: string,
        userId: string,
        cycleYearMonth: string,
        paidAt: Date,
      ) => {
        if (walletCardId !== CARD_A_ID || userId !== USER_A_ID) return null;
        const list = mockPaidCycles[CARD_A_ID] ?? [];
        if (!list.includes(cycleYearMonth)) {
          list.push(cycleYearMonth);
          mockPaidCycles[CARD_A_ID] = list;
        }
        // Dismiss any active notifications for this card + cycle
        const prefix = `PAYMENT_DUE:${walletCardId}:${cycleYearMonth}:`;
        for (const n of mockNotifications) {
          if (
            n.userId === userId &&
            n.dedupeKey.startsWith(prefix) &&
            n.dismissedAt === null
          ) {
            n.dismissedAt = paidAt.toISOString();
          }
        }
        return {
          walletCardId,
          cycleYearMonth,
          paidAt: paidAt.toISOString(),
        };
      },
    });

    app.set("notificationRepo", {
      findUsersForReminderJob: async () => [
        {
          id: USER_A_ID,
          timeZone: "America/Los_Angeles",
          preferences: [] as NotificationPreferenceItem[],
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

  it("AC1 & Validation: validates dueDay 1-31 whole number and updates card payment settings", async () => {
    const authCookie = await createAuthCookie(USER_A_ID, "usera@example.com");
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const cookies = `${authCookie}; ${csrfCookie}`;

    // Rejects invalid dueDay (0 and 32)
    const badLow = await request(app)
      .put(`/api/v1/wallet/cards/${CARD_A_ID}/payment-settings`)
      .set("Cookie", cookies)
      .set("x-csrf-token", csrfToken)
      .send({ dueDay: 0, isAutopay: false });
    expect(badLow.status).toBe(400);

    const badHigh = await request(app)
      .put(`/api/v1/wallet/cards/${CARD_A_ID}/payment-settings`)
      .set("Cookie", cookies)
      .set("x-csrf-token", csrfToken)
      .send({ dueDay: 32, isAutopay: true });
    expect(badHigh.status).toBe(400);

    // Valid update
    const okRes = await request(app)
      .put(`/api/v1/wallet/cards/${CARD_A_ID}/payment-settings`)
      .set("Cookie", cookies)
      .set("x-csrf-token", csrfToken)
      .send({ dueDay: 28, isAutopay: true });
    expect(okRes.status).toBe(200);
    expect(okRes.body.walletCard.paymentSettings).toEqual({
      dueDay: 28,
      isAutopay: true,
    });
  });

  it("Security: User B cannot change User A's card payment settings or mark User A's cycle paid (returns 404)", async () => {
    const userBAuthCookie = await createAuthCookie(
      USER_B_ID,
      "userb@example.com",
    );
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const userBCookies = `${userBAuthCookie}; ${csrfCookie}`;

    const settingsAttempt = await request(app)
      .put(`/api/v1/wallet/cards/${CARD_A_ID}/payment-settings`)
      .set("Cookie", userBCookies)
      .set("x-csrf-token", csrfToken)
      .send({ dueDay: 20, isAutopay: true });
    expect(settingsAttempt.status).toBe(404);

    const paidAttempt = await request(app)
      .post(`/api/v1/wallet/cards/${CARD_A_ID}/paid-cycles`)
      .set("Cookie", userBCookies)
      .set("x-csrf-token", csrfToken)
      .send({ cycleYearMonth: "2026-11" });
    expect(paidAttempt.status).toBe(404);
  });

  it("AC4: marking a cycle Paid dismisses active reminders, stops that cycle's future reminders, and still reminds next month", async () => {
    const authCookie = await createAuthCookie(USER_A_ID, "usera@example.com");
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const cookies = `${authCookie}; ${csrfCookie}`;

    // 1. Cron runs 5 days before Nov 15 (2026-11-10) -> creates 5-day reminder
    const cron1 = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(cron1.status).toBe(200);
    expect(cron1.body.createdCount).toBe(1);

    // 2. User A marks 2026-11 cycle as Paid
    const markPaidRes = await request(app)
      .post(`/api/v1/wallet/cards/${CARD_A_ID}/paid-cycles`)
      .set("Cookie", cookies)
      .set("x-csrf-token", csrfToken)
      .send({ cycleYearMonth: "2026-11" });
    expect(markPaidRes.status).toBe(200);
    expect(markPaidRes.body.paidCycle.cycleYearMonth).toBe("2026-11");

    // Active notification for 2026-11 is dismissed
    const activeAfterPaid = await request(app)
      .get("/api/v1/notifications")
      .set("Cookie", cookies);
    expect(activeAfterPaid.body.notifications).toHaveLength(0);

    // 3. Advance clock to 1 day before Nov 15 (2026-11-14) -> no reminder created because 2026-11 is paid
    currentNow = new Date("2026-11-14T18:00:00.000Z");
    const cronNov14 = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(cronNov14.status).toBe(200);
    expect(cronNov14.body.createdCount).toBe(0);

    // 4. Advance clock to next month 5 days before Dec 15 (2026-12-10) -> Dec reminder IS created
    currentNow = new Date("2026-12-10T18:00:00.000Z");
    const cronDec10 = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(cronDec10.status).toBe(200);
    expect(cronDec10.body.createdCount).toBe(1);
    expect(mockNotifications[mockNotifications.length - 1]?.dedupeKey).toBe(
      `PAYMENT_DUE:${CARD_A_ID}:2026-12:5`,
    );
  });
});
