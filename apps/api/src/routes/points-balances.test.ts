import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";
import {
  NotificationItem,
  NotificationPreferenceItem,
  ProgramPointsBalanceItem,
} from "@swipewise/shared";
import { createApp } from "../app.js";
import { getJwtSecret } from "../middleware/auth.middleware.js";
import {
  createReminderGeneratorRegistry,
  GeneratedReminderCandidate,
} from "../domain/reminders.js";
import {
  calculatePointsValueCents,
  createPointsExpiryReminderGenerator,
  PointsBalanceReminderInput,
} from "../domain/points-expiry.js";
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

describe("Points Balances & Expiry Alerts API route tests (US-09 / Issue #24)", () => {
  const TEST_CRON_SECRET = "test-cron-secret-24";
  const USER_A_ID = "11111111-1111-4111-8111-111111111111";
  const USER_B_ID = "22222222-2222-4222-8222-222222222222";
  const PROGRAM_HARBOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const PROGRAM_CASHBACK_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const BALANCE_A_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  let currentNow = new Date("2026-12-01T18:00:00.000Z"); // 2026-12-01 in America/Los_Angeles
  let mockPrefsByUser: Record<string, NotificationPreferenceItem[]> = {};
  let mockNotifications: NotificationItem[] = [];
  let mockSavedBalances: Record<
    string,
    {
      balanceId: string;
      userId: string;
      programId: string;
      pointsBalance: number;
      expiryDate: string;
    }
  > = {};

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

  const walletProgramsByUser: Record<
    string,
    Array<{
      programId: string;
      programName: string;
      centsPer100Points: number;
    }>
  > = {
    [USER_A_ID]: [
      {
        programId: PROGRAM_CASHBACK_ID,
        programName: "Cash Back",
        centsPer100Points: 100,
      },
      {
        programId: PROGRAM_HARBOR_ID,
        programName: "Harbor Points",
        centsPer100Points: 125,
      },
    ],
    [USER_B_ID]: [],
  };

  beforeEach(() => {
    currentNow = new Date("2026-12-01T18:00:00.000Z");
    mockPrefsByUser = {
      [USER_A_ID]: [],
      [USER_B_ID]: [],
    };
    mockNotifications = [];
    mockSavedBalances = {
      [`${USER_A_ID}:${PROGRAM_HARBOR_ID}`]: {
        balanceId: BALANCE_A_ID,
        userId: USER_A_ID,
        programId: PROGRAM_HARBOR_ID,
        pointsBalance: 10000,
        expiryDate: "2026-12-31",
      },
    };

    registry.register(
      "POINTS_EXPIRY",
      createPointsExpiryReminderGenerator(async (userId: string) => {
        const programs = walletProgramsByUser[userId] ?? [];
        const items: PointsBalanceReminderInput[] = [];
        for (const prog of programs) {
          const saved = mockSavedBalances[`${userId}:${prog.programId}`];
          if (saved) {
            items.push({
              balanceId: saved.balanceId,
              userId,
              programId: prog.programId,
              programName: prog.programName,
              centsPer100Points: prog.centsPer100Points,
              pointsBalance: saved.pointsBalance,
              expiryDate: saved.expiryDate,
            });
          }
        }
        return items;
      }),
    );

    app.set("pointsBalanceRepo", {
      findWalletProgramsWithBalancesByUserId: async (
        userId: string,
      ): Promise<ProgramPointsBalanceItem[]> => {
        const programs = walletProgramsByUser[userId] ?? [];
        return programs.map((prog) => {
          const saved = mockSavedBalances[`${userId}:${prog.programId}`];
          return {
            programId: prog.programId,
            programName: prog.programName,
            centsPer100Points: prog.centsPer100Points,
            balanceId: saved ? saved.balanceId : null,
            pointsBalance: saved ? saved.pointsBalance : null,
            valueCents: saved
              ? calculatePointsValueCents(
                  saved.pointsBalance,
                  prog.centsPer100Points,
                )
              : null,
            expiryDate: saved ? saved.expiryDate : null,
          };
        });
      },
      upsertProgramBalanceForUser: async (data: {
        userId: string;
        programId: string;
        pointsBalance: number;
        expiryDate: string;
      }): Promise<ProgramPointsBalanceItem | null> => {
        const programs = walletProgramsByUser[data.userId] ?? [];
        const foundProg = programs.find((p) => p.programId === data.programId);
        if (!foundProg) {
          return null;
        }
        const key = `${data.userId}:${data.programId}`;
        const existing = mockSavedBalances[key];
        const balanceId =
          existing?.balanceId ?? "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
        mockSavedBalances[key] = {
          balanceId,
          userId: data.userId,
          programId: data.programId,
          pointsBalance: data.pointsBalance,
          expiryDate: data.expiryDate,
        };
        return {
          programId: foundProg.programId,
          programName: foundProg.programName,
          centsPer100Points: foundProg.centsPer100Points,
          balanceId,
          pointsBalance: data.pointsBalance,
          valueCents: calculatePointsValueCents(
            data.pointsBalance,
            foundProg.centsPer100Points,
          ),
          expiryDate: data.expiryDate,
        };
      },
      findReminderBalancesByUserId: async (
        userId: string,
      ): Promise<PointsBalanceReminderInput[]> => {
        const programs = walletProgramsByUser[userId] ?? [];
        const result: PointsBalanceReminderInput[] = [];
        for (const prog of programs) {
          const saved = mockSavedBalances[`${userId}:${prog.programId}`];
          if (saved) {
            result.push({
              balanceId: saved.balanceId,
              userId,
              programId: prog.programId,
              programName: prog.programName,
              centsPer100Points: prog.centsPer100Points,
              pointsBalance: saved.pointsBalance,
              expiryDate: saved.expiryDate,
            });
          }
        }
        return result;
      },
    });

    app.set("notificationRepo", {
      findUsersForReminderJob: async () => [
        {
          id: USER_A_ID,
          timeZone: "America/Los_Angeles",
          preferences: mockPrefsByUser[USER_A_ID] ?? [],
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

  it("AC1 & AC2: GET /api/v1/points-balances returns wallet programs with dollar value and expiry, and PUT upserts a balance", async () => {
    const authCookie = await createAuthCookie(USER_A_ID, "usera@example.com");
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const cookies = `${authCookie}; ${csrfCookie}`;

    const getRes = await request(app)
      .get("/api/v1/points-balances")
      .set("Cookie", cookies);

    expect(getRes.status).toBe(200);
    expect(getRes.body.programs).toHaveLength(2);
    expect(getRes.body.programs).toEqual([
      {
        programId: PROGRAM_CASHBACK_ID,
        programName: "Cash Back",
        centsPer100Points: 100,
        balanceId: null,
        pointsBalance: null,
        valueCents: null,
        expiryDate: null,
      },
      {
        programId: PROGRAM_HARBOR_ID,
        programName: "Harbor Points",
        centsPer100Points: 125,
        balanceId: BALANCE_A_ID,
        pointsBalance: 10000,
        valueCents: 12500,
        expiryDate: "2026-12-31",
      },
    ]);

    // Upsert Cash Back balance (5,000 points at 100 cents/100 pts = 5,000 cents)
    const putRes = await request(app)
      .put(`/api/v1/points-balances/${PROGRAM_CASHBACK_ID}`)
      .set("Cookie", cookies)
      .set("x-csrf-token", csrfToken)
      .send({
        pointsBalance: 5000,
        expiryDate: "2027-06-30",
      });

    expect(putRes.status).toBe(200);
    expect(putRes.body.programBalance).toMatchObject({
      programId: PROGRAM_CASHBACK_ID,
      programName: "Cash Back",
      pointsBalance: 5000,
      valueCents: 5000,
      expiryDate: "2027-06-30",
    });
  });

  it("Validation & Auth: enforces login, CSRF, and Zod bounds on PUT /api/v1/points-balances/:programId", async () => {
    const unauthRes = await request(app).get("/api/v1/points-balances");
    expect(unauthRes.status).toBe(401);

    const authCookie = await createAuthCookie(USER_A_ID, "usera@example.com");
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const cookies = `${authCookie}; ${csrfCookie}`;

    // Missing CSRF token -> 403
    const noCsrf = await request(app)
      .put(`/api/v1/points-balances/${PROGRAM_HARBOR_ID}`)
      .set("Cookie", cookies)
      .send({ pointsBalance: 1000, expiryDate: "2026-12-31" });
    expect(noCsrf.status).toBe(403);

    // Invalid balance (> 1,000,000,000) -> 400
    const badBalance = await request(app)
      .put(`/api/v1/points-balances/${PROGRAM_HARBOR_ID}`)
      .set("Cookie", cookies)
      .set("x-csrf-token", csrfToken)
      .send({ pointsBalance: 1_000_000_001, expiryDate: "2026-12-31" });
    expect(badBalance.status).toBe(400);

    // Invalid calendar date -> 400
    const badDate = await request(app)
      .put(`/api/v1/points-balances/${PROGRAM_HARBOR_ID}`)
      .set("Cookie", cookies)
      .set("x-csrf-token", csrfToken)
      .send({ pointsBalance: 5000, expiryDate: "2026-02-30" });
    expect(badDate.status).toBe(400);
  });

  it("Security: User B cannot see or change User A's balance or a program not in User B's wallet (returns 404)", async () => {
    const userBAuthCookie = await createAuthCookie(
      USER_B_ID,
      "userb@example.com",
    );
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const userBCookies = `${userBAuthCookie}; ${csrfCookie}`;

    // User B GET sees 0 programs and cannot see User A's Harbor Points balance
    const getB = await request(app)
      .get("/api/v1/points-balances")
      .set("Cookie", userBCookies);
    expect(getB.status).toBe(200);
    expect(getB.body.programs).toHaveLength(0);

    // User B tries to PUT User A's program -> 404
    const putProgramAttempt = await request(app)
      .put(`/api/v1/points-balances/${PROGRAM_HARBOR_ID}`)
      .set("Cookie", userBCookies)
      .set("x-csrf-token", csrfToken)
      .send({ pointsBalance: 999, expiryDate: "2026-12-31" });
    expect(putProgramAttempt.status).toBe(404);
    expect(putProgramAttempt.body.error.code).toBe("NOT_FOUND");

    // User B tries to PUT using User A's balanceId -> 404
    const putBalanceIdAttempt = await request(app)
      .put(`/api/v1/points-balances/${BALANCE_A_ID}`)
      .set("Cookie", userBCookies)
      .set("x-csrf-token", csrfToken)
      .send({ pointsBalance: 999, expiryDate: "2026-12-31" });
    expect(putBalanceIdAttempt.status).toBe(404);
  });

  it("AC3: cron generates 30-day and 7-day reminders, is idempotent, and creates new reminders when expiry date changes", async () => {
    const authCookie = await createAuthCookie(USER_A_ID, "usera@example.com");
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const cookies = `${authCookie}; ${csrfCookie}`;

    // 1. Run cron 30 days before 2026-12-31 (2026-12-01) -> creates :30 reminder
    const cron1 = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(cron1.status).toBe(200);
    expect(cron1.body.createdCount).toBe(1);
    expect(mockNotifications[0]?.dedupeKey).toBe(
      `POINTS_EXPIRY:${BALANCE_A_ID}:2026-12-31:30`,
    );

    // 2. Run cron a second time on 2026-12-01 -> no duplicates
    const cron2 = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(cron2.body.createdCount).toBe(0);

    // 3. Advance clock to 7 days before 2026-12-31 (2026-12-24) -> creates :7 reminder
    currentNow = new Date("2026-12-24T18:00:00.000Z");
    const cron3 = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(cron3.body.createdCount).toBe(1);
    expect(mockNotifications[1]?.dedupeKey).toBe(
      `POINTS_EXPIRY:${BALANCE_A_ID}:2026-12-31:7`,
    );

    // 4. User A changes expiry date to 2027-01-20; 30 days before is 2026-12-21 (caught up on 2026-12-24!)
    const updateExpiry = await request(app)
      .put(`/api/v1/points-balances/${PROGRAM_HARBOR_ID}`)
      .set("Cookie", cookies)
      .set("x-csrf-token", csrfToken)
      .send({ pointsBalance: 10000, expiryDate: "2027-01-20" });
    expect(updateExpiry.status).toBe(200);

    const cron4 = await request(app)
      .get("/api/v1/cron/reminders")
      .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);
    expect(cron4.body.createdCount).toBe(1);
    expect(mockNotifications[2]?.dedupeKey).toBe(
      `POINTS_EXPIRY:${BALANCE_A_ID}:2027-01-20:30`,
    );
  });
});
