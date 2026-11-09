import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";
import fs from "node:fs";
import path from "node:path";
import {
  NotificationItem,
  NotificationPreferenceItem,
  ReminderTypeName,
} from "@swipewise/shared";
import { createApp } from "../app.js";
import { getJwtSecret } from "../middleware/auth.middleware.js";
import {
  createReminderGeneratorRegistry,
  createTestReminderGenerator,
  GeneratedReminderCandidate,
} from "../domain/reminders.js";
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

describe("Reminders Cron & Notifications API route tests (US-05..09 / Issue #19)", () => {
  const TEST_CRON_SECRET = "test-cron-secret-value-12345";
  const fixedNow = new Date("2026-11-10T03:30:00.000Z"); // 2026-11-09 in America/Los_Angeles
  const USER_A_ID = "11111111-1111-4111-8111-111111111111";
  const USER_B_ID = "22222222-2222-4222-8222-222222222222";

  let mockUsers: Array<{
    id: string;
    timeZone: string;
    preferences: NotificationPreferenceItem[];
  }> = [];
  let mockNotifications: NotificationItem[] = [];
  let mockPrefsByUser: Record<string, NotificationPreferenceItem[]> = {};

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
    nowProvider: () => fixedNow,
  });

  beforeEach(() => {
    for (const type of [
      "PAYMENT_DUE",
      "PERK_ENDING",
      "ROTATING_CATEGORY",
      "POINTS_EXPIRY",
    ] as ReminderTypeName[]) {
      registry.unregister(type);
    }

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

    mockPrefsByUser = {
      [USER_A_ID]: [],
      [USER_B_ID]: [],
    };
    mockUsers = [
      {
        id: USER_A_ID,
        timeZone: "America/Los_Angeles",
        preferences: mockPrefsByUser[USER_A_ID]!,
      },
    ];
    mockNotifications = [];

    app.set("notificationRepo", {
      findUsersForReminderJob: async () =>
        mockUsers.map((u) => ({
          id: u.id,
          timeZone: u.timeZone,
          preferences: mockPrefsByUser[u.id] ?? [],
        })),
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
              createdAt: fixedNow.toISOString(),
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
      dismissNotification: async (
        id: string,
        userId: string,
        dismissedAt: Date,
      ) => {
        const found = mockNotifications.find(
          (n) => n.id === id && n.userId === userId,
        );
        if (!found) return null;
        found.dismissedAt = dismissedAt.toISOString();
        return found;
      },
      dismissAllNotifications: async (userId: string, dismissedAt: Date) => {
        let count = 0;
        for (const n of mockNotifications) {
          if (n.userId === userId && n.dismissedAt === null) {
            n.dismissedAt = dismissedAt.toISOString();
            count += 1;
          }
        }
        return count;
      },
      findPreferencesByUserId: async (userId: string) =>
        mockPrefsByUser[userId] ?? [],
      upsertPreferences: async (
        userId: string,
        updates: NotificationPreferenceItem[],
      ) => {
        const current = [...(mockPrefsByUser[userId] ?? [])];
        for (const upd of updates) {
          const idx = current.findIndex((p) => p.type === upd.type);
          if (idx >= 0) {
            current[idx] = upd;
          } else {
            current.push(upd);
          }
        }
        mockPrefsByUser[userId] = current;
        return current;
      },
    });
  });

  describe("GET /api/v1/cron/reminders", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const res = await request(app).get("/api/v1/cron/reminders");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 when Authorization Bearer secret is wrong", async () => {
      const res = await request(app)
        .get("/api/v1/cron/reminders")
        .set("Authorization", "Bearer wrong-secret-token");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("AC1: succeeds with valid Bearer CRON_SECRET without login or CSRF, and running twice creates no duplicates", async () => {
      const firstRun = await request(app)
        .get("/api/v1/cron/reminders")
        .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);

      expect(firstRun.status).toBe(200);
      expect(firstRun.body.createdCount).toBe(2);
      expect(mockNotifications).toHaveLength(2);
      expect(mockNotifications[0]?.dueDate).toBe("2026-11-09");

      // Second run on the same day creates zero duplicates
      const secondRun = await request(app)
        .get("/api/v1/cron/reminders")
        .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);

      expect(secondRun.status).toBe(200);
      expect(secondRun.body.createdCount).toBe(0);
      expect(mockNotifications).toHaveLength(2);
    });

    it("AC3: user with no saved preference counts as enabled by default, and a disabled type creates nothing", async () => {
      // Disable PERK_ENDING for USER_A_ID, leave PAYMENT_DUE unsaved (enabled by default)
      mockPrefsByUser[USER_A_ID] = [{ type: "PERK_ENDING", enabled: false }];

      const res = await request(app)
        .get("/api/v1/cron/reminders")
        .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);

      expect(res.status).toBe(200);
      expect(res.body.createdCount).toBe(1);
      expect(mockNotifications).toHaveLength(1);
      expect(mockNotifications[0]?.type).toBe("PAYMENT_DUE");
    });

    it("vercel.json configures a daily cron job for /api/v1/cron/reminders", () => {
      const vercelPath = path.resolve(__dirname, "../../../../vercel.json");
      const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, "utf-8")) as {
        crons?: Array<{ path: string; schedule: string }>;
      };

      expect(Array.isArray(vercelConfig.crons)).toBe(true);
      expect(
        vercelConfig.crons?.some((c) => c.path === "/api/v1/cron/reminders"),
      ).toBe(true);
    });
  });

  describe("Notifications list & dismiss (/api/v1/notifications)", () => {
    it("returns 401 when unauthenticated", async () => {
      const res = await request(app).get("/api/v1/notifications");
      expect(res.status).toBe(401);
    });

    it("returns 403 on POST /api/v1/notifications/:id/dismiss without a CSRF token", async () => {
      const authCookie = await createAuthCookie(USER_A_ID, "usera@example.com");
      const res = await request(app)
        .post(
          "/api/v1/notifications/00000000-0000-4000-8000-000000000001/dismiss",
        )
        .set("Cookie", authCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("EBADCSRFTOKEN");
    });

    it("AC2: lists user's active notifications and dismisses one", async () => {
      await request(app)
        .get("/api/v1/cron/reminders")
        .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);

      const authCookie = await createAuthCookie(USER_A_ID, "usera@example.com");
      const { token: csrfToken, cookie: csrfCookie } =
        await getCsrfTokenAndCookie(app);
      const cookies = `${authCookie}; ${csrfCookie}`;

      const listRes = await request(app)
        .get("/api/v1/notifications")
        .set("Cookie", cookies);

      expect(listRes.status).toBe(200);
      expect(listRes.body.notifications).toHaveLength(2);

      const targetId = listRes.body.notifications[0].id as string;

      const dismissRes = await request(app)
        .post(`/api/v1/notifications/${targetId}/dismiss`)
        .set("Cookie", cookies)
        .set("x-csrf-token", csrfToken);

      expect(dismissRes.status).toBe(200);
      expect(dismissRes.body.notification.id).toBe(targetId);
      expect(dismissRes.body.notification.dismissedAt).not.toBeNull();

      const afterRes = await request(app)
        .get("/api/v1/notifications")
        .set("Cookie", cookies);

      expect(afterRes.status).toBe(200);
      expect(afterRes.body.notifications).toHaveLength(1);
    });

    it("AC2 & Security: User B cannot see or dismiss User A's notification (returns 404)", async () => {
      await request(app)
        .get("/api/v1/cron/reminders")
        .set("Authorization", `Bearer ${TEST_CRON_SECRET}`);

      const userANotificationId = mockNotifications[0]!.id;

      const userBAuthCookie = await createAuthCookie(
        USER_B_ID,
        "userb@example.com",
      );
      const { token: csrfToken, cookie: csrfCookie } =
        await getCsrfTokenAndCookie(app);
      const userBCookies = `${userBAuthCookie}; ${csrfCookie}`;

      // User B sees 0 notifications
      const userBList = await request(app)
        .get("/api/v1/notifications")
        .set("Cookie", userBCookies);
      expect(userBList.status).toBe(200);
      expect(userBList.body.notifications).toHaveLength(0);

      // User B tries to dismiss User A's notification -> 404
      const dismissAttempt = await request(app)
        .post(`/api/v1/notifications/${userANotificationId}/dismiss`)
        .set("Cookie", userBCookies)
        .set("x-csrf-token", csrfToken);

      expect(dismissAttempt.status).toBe(404);
      expect(dismissAttempt.body.error.code).toBe("NOT_FOUND");

      // User A's notification remains undismissed
      expect(mockNotifications[0]!.dismissedAt).toBeNull();
    });
  });

  describe("Notification preferences (/api/v1/notification-preferences)", () => {
    it("AC3: returns all 4 types enabled by default and updates a user's reminder preference", async () => {
      const authCookie = await createAuthCookie(USER_A_ID, "usera@example.com");
      const { token: csrfToken, cookie: csrfCookie } =
        await getCsrfTokenAndCookie(app);
      const cookies = `${authCookie}; ${csrfCookie}`;

      const getRes = await request(app)
        .get("/api/v1/notification-preferences")
        .set("Cookie", cookies);

      expect(getRes.status).toBe(200);
      expect(getRes.body.preferences).toEqual([
        { type: "PAYMENT_DUE", enabled: true },
        { type: "PERK_ENDING", enabled: true },
        { type: "ROTATING_CATEGORY", enabled: true },
        { type: "POINTS_EXPIRY", enabled: true },
      ]);

      const patchRes = await request(app)
        .patch("/api/v1/notification-preferences")
        .set("Cookie", cookies)
        .set("x-csrf-token", csrfToken)
        .send({ type: "ROTATING_CATEGORY", enabled: false });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.preferences).toEqual([
        { type: "PAYMENT_DUE", enabled: true },
        { type: "PERK_ENDING", enabled: true },
        { type: "ROTATING_CATEGORY", enabled: false },
        { type: "POINTS_EXPIRY", enabled: true },
      ]);
    });
  });
});
